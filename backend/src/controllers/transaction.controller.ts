import type { Request, Response } from "express";
import { pool } from "../db.js";
import { broadcast } from "../sse.js";

const getMonthFilter = (req: Request) => {
  return (
    (req.query.month as string) || new Date().toISOString().substring(0, 7)
  );
};

// UPGRADED: The brain of our billing system (Strict TypeScript Safe!)
const calculateBillingMonth = (
  dateString: string,
  cutoffDay: number | null,
): string => {
  if (!dateString) return "";

  // 1. Safe extraction: fallback to empty string if undefined
  const datePart = dateString.split("T")[0] || "";
  const dateElements = datePart.split("-");

  // 2. Safely parse each element, defaulting to 0 if they don't exist
  let year = Number(dateElements[0] || 0);
  let month = Number(dateElements[1] || 0);
  const day = Number(dateElements[2] || 0);

  // Failsafe: if the date was malformed, just return the current year/month
  if (!year || !month) return "";

  // 3. If we have a cutoff day and the purchase day is AFTER the cutoff, shift to next month
  if (cutoffDay && day >= cutoffDay) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  // 4. Format back to YYYY-MM
  return `${year}-${month.toString().padStart(2, "0")}`;
};

// Helper to add months to a YYYY-MM string safely
const addMonthsToBilling = (
  yyyyMM: string | null,
  monthsToAdd: number,
): string => {
  if (!yyyyMM) {
    // Fallback: If there's no billing month, use the current month
    const now = new Date();
    yyyyMM = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  }

  const [yearStr, monthStr] = yyyyMM.split("-");

  // FIXED: Added || "0" to satisfy TypeScript's strict null checks
  let year = parseInt(yearStr || "0", 10);
  let month = parseInt(monthStr || "0", 10);

  // Extra failsafe in case the string was completely malformed
  if (!year || !month) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  month += monthsToAdd;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${month.toString().padStart(2, "0")}`;
};

export const createTransaction = async (req: Request, res: Response) => {
  try {
    // We extract the data from the request body (req.body)
    const {
      merchant,
      location,
      date,
      card_type,
      auth_code,
      amount,
      is_third_party,
      third_party_id,
      type,
      is_base,
    } = req.body;

    // Extract the last 4 digits from the card_type string (e.g. "VISA *1234" -> "1234")
    const lastFourMatch = card_type ? card_type.match(/\d{4}$/) : null;
    const lastFour = lastFourMatch ? lastFourMatch[0] : null;

    let cutoffDay = null;
    let cardId = null;

    // If we found 4 digits, check if we have a card saved with those digits
    if (lastFour) {
      const cardResult = await pool.query(
        "SELECT id, cutoff_day FROM cards WHERE last_four = $1",
        [lastFour],
      );
      if (cardResult.rows.length > 0) {
        const foundCard = cardResult.rows[0];
        if (foundCard) {
          cardId = foundCard.id;
          cutoffDay = foundCard.cutoff_day;
        }
      }
    }

    // Let the brain calculate the billing month!
    const billingMonth = calculateBillingMonth(date, cutoffDay);

    // Save everything
    const insertQuery = `
      INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, is_third_party, third_party_id, type, is_base, billing_month, card_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *; 
    `;

    const values = [
      merchant,
      location,
      date,
      card_type,
      auth_code,
      amount,
      is_third_party || false,
      third_party_id || null,
      type || "EXPENSE",
      is_base || false,
      billingMonth,
      cardId,
    ];

    // We execute the query
    const result = await pool.query(insertQuery, values);
    const newTransaction = result.rows[0];

    broadcast("new_transaction", newTransaction);

    // We send the created transaction back to the client with a 201 Created status
    res.status(201).json({
      message: "Transaction created successfully",
      transaction: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error saving transaction:", error);

    // Check if the error is due to a duplicate auth_code (Postgres error code 23505)
    if (error.code === "23505") {
      res
        .status(409)
        .json({ error: "A transaction with this auth code already exists." });
      return;
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const month = getMonthFilter(req);

    const selectQuery = `
      SELECT 
        t.*, 
        p.name as third_party_name,
        f.merchant as linked_fixed_name
      FROM transactions t
      LEFT JOIN third_parties p ON t.third_party_id = p.id
      LEFT JOIN transactions f ON t.linked_fixed_id = f.id
      WHERE t.type = 'EXPENSE' AND t.is_base = false AND t.billing_month = $1
      ORDER BY t.date DESC
    `;

    const result = await pool.query(selectQuery, [month]);
    res.status(200).json({ transactions: result.rows });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSummary = async (req: Request, res: Response) => {
  try {
    const month = getMonthFilter(req);
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = false AND is_tasa_cero = false AND linked_fixed_id IS NULL), 0) AS personal_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = true AND is_tasa_cero = false), 0) AS fixed_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = true AND is_tasa_cero = false), 0) AS third_party_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND is_base = true), 0) AS base_income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND is_base = false), 0) AS extra_income
      FROM transactions
      WHERE billing_month = $1;
    `;

    const result = await pool.query(summaryQuery, [month]);
    const personal = parseFloat(result.rows[0].personal_expenses);
    const fixed = parseFloat(result.rows[0].fixed_expenses);
    const thirdParty = parseFloat(result.rows[0].third_party_expenses);
    const baseIncome = parseFloat(result.rows[0].base_income);
    const extraIncome = parseFloat(result.rows[0].extra_income);

    res.status(200).json({
      personalExpenses: personal,
      fixedExpenses: fixed,
      thirdPartyExpenses: thirdParty,
      baseIncome,
      extraIncome,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getChartData = async (req: Request, res: Response) => {
  try {
    const month = getMonthFilter(req);

    const chartQuery = `
      SELECT 
        TO_CHAR(date, 'YYYY-MM-DD') as day,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'EXPENSE' AND billing_month = $1 AND is_tasa_cero = false AND is_base = false AND linked_fixed_id IS NULL
      GROUP BY TO_CHAR(date, 'YYYY-MM-DD')
      ORDER BY day ASC
    `;

    const result = await pool.query(chartQuery, [month]);
    const formattedData = result.rows.map((row) => ({
      day: row.day,
      total: parseFloat(row.total),
    }));

    res.status(200).json({ chartData: formattedData });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateRecentTransaction = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    merchant,
    is_base,
    is_third_party,
    third_party_id,
    is_split_action,
    split_amount,
    note,
    is_tasa_cero_action,
    tasa_cero_months,
    revert_tasa_cero_action,
    linked_fixed_id,
  } = req.body;

  // --- REVERT TASA 0 LOGIC ---
  if (revert_tasa_cero_action) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // 1. Delete all clones
      await client.query("DELETE FROM transactions WHERE parent_id = $1", [id]);
      // 2. Restore original
      await client.query(
        "UPDATE transactions SET is_tasa_cero = false WHERE id = $1",
        [id],
      );
      await client.query("COMMIT");
      broadcast("transaction_updated", {});
      return res.status(200).json({ message: "Tasa 0 reverted successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  }

  // --- APPLY TASA 0 LOGIC ---
  if (is_tasa_cero_action && tasa_cero_months > 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const origResult = await client.query(
        "SELECT * FROM transactions WHERE id = $1",
        [id],
      );
      if (origResult.rows.length === 0) throw new Error("Not found");

      const originalTx = origResult.rows[0];
      const originalAmount = parseFloat(originalTx.amount);
      const installmentAmount = originalAmount / tasa_cero_months;

      // 1. Make original a ghost
      await client.query(
        "UPDATE transactions SET is_tasa_cero = true, note = $1 WHERE id = $2",
        [note || null, id],
      );

      // 2. Create clones
      const insertCloneQuery = `
        INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, type, is_base, billing_month, card_id, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10)
      `;

      for (let i = 0; i < tasa_cero_months; i++) {
        const targetMonth = addMonthsToBilling(originalTx.billing_month, i);
        const cloneMerchant = `${merchant} (Cuota ${i + 1}/${tasa_cero_months})`;
        const cloneAuthCode = `${originalTx.auth_code}-T0-${i + 1}`; // Unique auth code

        await client.query(insertCloneQuery, [
          cloneMerchant,
          originalTx.location || null,
          originalTx.date,
          originalTx.card_type || "Unknown",
          cloneAuthCode,
          installmentAmount,
          originalTx.type || "EXPENSE",
          targetMonth,
          originalTx.card_id || null,
          id,
        ]);
      }

      await client.query("COMMIT");
      broadcast("transaction_updated", {});
      return res.status(200).json({ message: "Tasa 0 applied successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error applying Tasa 0:", error); // <--- Esto imprimirá el error exacto en tu terminal
      return res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  }

  // --- THE SPLIT LOGIC ---
  if (is_split_action && split_amount) {
    // 1. Acquire a dedicated client for the SQL Transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 2. Find the original transaction
      const origResult = await client.query(
        "SELECT * FROM transactions WHERE id = $1",
        [id],
      );

      if (origResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Transaction not found" });
      }

      const originalTx = origResult.rows[0];
      const originalAmount = parseFloat(originalTx.amount);
      const thirdPartyAmount = parseFloat(split_amount);
      const personalAmount = originalAmount - thirdPartyAmount;

      // 3. Strict Validations
      if (thirdPartyAmount <= 0 || thirdPartyAmount >= originalAmount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid split amount" });
      }

      if (!third_party_id) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Third party ID is required for splitting" });
      }

      // 4. Update the original row to be the "Personal" portion
      const personalAuthCode = originalTx.auth_code + "-P"; // P for Personal
      const updateOrigQuery = `
        UPDATE transactions 
        SET merchant = $1, amount = $2, is_third_party = false, third_party_id = null, is_split = true, auth_code = $3, note = $4
        WHERE id = $5 RETURNING *;
      `;
      await client.query(updateOrigQuery, [
        merchant,
        personalAmount,
        personalAuthCode,
        note || null,
        id,
      ]);

      // 5. Insert a NEW cloned row for the "Third Party" portion
      const thirdPartyAuthCode = originalTx.auth_code + "-S"; // S for Shared/Split
      const insertSplitQuery = `
        INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, is_third_party, third_party_id, type, is_base, billing_month, card_id, is_split, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
      `;
      await client.query(insertSplitQuery, [
        merchant,
        originalTx.location,
        originalTx.date,
        originalTx.card_type,
        thirdPartyAuthCode,
        thirdPartyAmount,
        true,
        third_party_id || null,
        originalTx.type,
        originalTx.is_base,
        originalTx.billing_month,
        originalTx.card_id || null,
        note || null,
      ]);

      // 6. Commit the transaction if everything succeeded
      await client.query("COMMIT");

      // Tell the UI to refresh
      broadcast("transaction_updated", {});
      return res
        .status(200)
        .json({ message: "Transaction split successfully" });
    } catch (error) {
      // If ANYTHING fails, undo all changes
      await client.query("ROLLBACK");
      console.error("Error splitting transaction:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  // --- NORMAL UPDATE LOGIC (If not splitting) ---
  try {
    const updateQuery = `
      UPDATE transactions 
      SET merchant = $1, is_base = $2, is_third_party = $3, third_party_id = $4, note = $5, linked_fixed_id = $6
      WHERE id = $7
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
      merchant,
      is_base,
      is_third_party,
      third_party_id || null,
      note || null,
      linked_fixed_id || null,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    broadcast("transaction_updated", result.rows[0]);
    return res
      .status(200)
      .json({ message: "Transaction updated", transaction: result.rows[0] });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getIncomes = async (req: Request, res: Response) => {
  try {
    const month = getMonthFilter(req);
    const selectQuery = `SELECT * FROM transactions WHERE type = 'INCOME' AND billing_month = $1 ORDER BY date DESC;`;
    const result = await pool.query(selectQuery, [month]);
    res.status(200).json({ incomes: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Fetch the transaction to check its origin (auth_code)
    const checkQuery = "SELECT auth_code FROM transactions WHERE id = $1";
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const authCode = checkResult.rows[0].auth_code;

    // 2. If it was created manually (starts with FIX- or INC-), delete it completely
    if (authCode.startsWith("FIX-") || authCode.startsWith("INC-")) {
      await pool.query("DELETE FROM transactions WHERE id = $1", [id]);

      broadcast("transaction_deleted", { id });
      res.status(200).json({ message: "Deleted successfully" });
    }
    // 3. If it comes from the bank, DO NOT delete it. Revert it to a normal expense!
    else {
      const revertQuery = `
        UPDATE transactions 
        SET is_base = false, is_third_party = false, third_party_id = null, type = 'EXPENSE'
        WHERE id = $1 
        RETURNING *;
      `;
      const updateResult = await pool.query(revertQuery, [id]);

      // We broadcast an UPDATE instead of a DELETE
      broadcast("transaction_updated", updateResult.rows[0]);

      res.status(200).json({
        message: "Reverted to normal transaction",
        transaction: updateResult.rows[0],
      });
    }
  } catch (error) {
    console.error("Error handling transaction deletion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { merchant, amount, is_base, date } = req.body;

    // 1. Check if this transaction belongs to a card to apply cutoff rules
    const txCheckQuery = await pool.query(
      "SELECT card_id FROM transactions WHERE id = $1",
      [id],
    );

    if (txCheckQuery.rows.length === 0) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const cardId = txCheckQuery.rows[0].card_id;
    let cutoffDay = null;

    if (cardId) {
      const cardCheckQuery = await pool.query(
        "SELECT cutoff_day FROM cards WHERE id = $1",
        [cardId],
      );
      if (cardCheckQuery.rows.length > 0) {
        const foundCard = cardCheckQuery.rows[0];
        if (foundCard) {
          cutoffDay = foundCard.cutoff_day;
        }
      }
    }

    // 2. Recalculate the correct billing month with the new date
    const newBillingMonth = calculateBillingMonth(date, cutoffDay);

    // 3. UPDATE the SQL query to include billing_month = $5
    const updateQuery = `
      UPDATE transactions 
      SET merchant = $1, amount = $2, is_base = $3, date = $4, billing_month = $5 
      WHERE id = $6 
      RETURNING *;
    `;

    // 4. Execute with all 6 parameters
    const result = await pool.query(updateQuery, [
      merchant,
      amount,
      is_base,
      date,
      newBillingMonth,
      id,
    ]);

    broadcast("transaction_updated", result.rows[0]);
    res.status(200).json({ transaction: result.rows[0] });
  } catch (error) {
    console.error("Error updating transaction details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getFixedExpenses = async (req: Request, res: Response) => {
  try {
    const month = getMonthFilter(req);
    const selectQuery = `SELECT * FROM transactions WHERE type = 'EXPENSE' AND is_base = true AND billing_month = $1 ORDER BY date DESC;`;
    const result = await pool.query(selectQuery, [month]);
    res.status(200).json({ fixedExpenses: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// NEW: Copy all fixed expenses from the previous month to current month
export const copyPreviousFixedExpenses = async (
  req: Request,
  res: Response,
) => {
  try {
    const targetMonth = getMonthFilter(req); // e.g. "2026-08"

    const [yearStr, monthStr] = targetMonth.split("-");
    let year = Number(yearStr || 0);
    let month = Number(monthStr || 0);

    // Calculate previous month
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    const previousMonth = `${year}-${month.toString().padStart(2, "0")}`;

    // 1. Fetch previous month's fixed expenses
    const selectQuery = `
      SELECT merchant, location, card_type, amount 
      FROM transactions 
      WHERE type = 'EXPENSE' AND is_base = true AND billing_month = $1;
    `;
    const previousResult = await pool.query(selectQuery, [previousMonth]);

    if (previousResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No fixed expenses found in previous month." });
    }

    // 2. Insert into current target month with 1st day of target month as date
    const insertQuery = `
      INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, is_third_party, type, is_base, billing_month)
      VALUES ($1, $2, $3, $4, $5, $6, false, 'EXPENSE', true, $7)
    `;

    const defaultDate = `${targetMonth}-01T12:00:00Z`;

    for (const exp of previousResult.rows) {
      const authCode = `FIX-${Math.floor(Math.random() * 1000000)}`;
      await pool.query(insertQuery, [
        exp.merchant,
        exp.location || "Auto-Pay",
        defaultDate,
        exp.card_type || "DIRECT",
        authCode,
        exp.amount,
        targetMonth,
      ]);
    }

    broadcast("transaction_updated", {});

    res.status(201).json({
      message: `Copied ${previousResult.rows.length} fixed expenses successfully!`,
      count: previousResult.rows.length,
    });
  } catch (error) {
    console.error("Error copying fixed expenses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
