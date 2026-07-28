import type { Request, Response } from "express";
import { pool } from "../db.js";
import { broadcast } from "../sse.js";

const getMonthFilter = (req: Request) => {
  return (
    (req.query.month as string) || new Date().toISOString().substring(0, 7)
  );
};

// NEW: The brain of our billing system
const calculateBillingMonth = (
  dateString: string,
  cutoffDay: number | null,
): string => {
  const date = new Date(dateString);
  let year = date.getFullYear();
  let month = date.getMonth() + 1; // JavaScript months are 0-11
  const day = date.getDate();

  // If we have a cutoff day and the purchase day is AFTER the cutoff, shift to next month!
  if (cutoffDay && day > cutoffDay) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  // Format back to YYYY-MM
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
        cardId = cardResult.rows[0].id;
        cutoffDay = cardResult.rows[0].cutoff_day;
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
      SELECT t.*, p.name as third_party_name 
      FROM transactions t
      LEFT JOIN third_parties p ON t.third_party_id = p.id
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
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = false), 0) AS personal_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = true), 0) AS fixed_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = true), 0) AS third_party_expenses,
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
      WHERE type = 'EXPENSE' AND billing_month = $1
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
  try {
    const { id } = req.params;
    const { merchant, is_base, is_third_party, third_party_id } = req.body;

    const updateQuery = `
      UPDATE transactions 
      SET merchant = $1, is_base = $2, is_third_party = $3, third_party_id = $4 
      WHERE id = $5 
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      merchant,
      is_base,
      is_third_party,
      third_party_id,
      id,
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const updatedTransaction = result.rows[0];

    // Tell all connected browsers that a transaction changed!
    broadcast("transaction_updated", updatedTransaction);

    res.status(200).json({
      message: "Transaction updated successfully",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
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

    if (checkResult.rowCount === 0) {
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
    // 1. ADD 'date' to the destructured body
    const { merchant, amount, is_base, date } = req.body;

    // 2. UPDATE the SQL query to include date = $4
    const updateQuery = `
      UPDATE transactions 
      SET merchant = $1, amount = $2, is_base = $3, date = $4 
      WHERE id = $5 
      RETURNING *;
    `;

    // 3. Pass the date variable into the array
    const result = await pool.query(updateQuery, [
      merchant,
      amount,
      is_base,
      date,
      id,
    ]);

    broadcast("transaction_updated", result.rows[0]);
    res.status(200).json({ transaction: result.rows[0] });
  } catch (error) {
    console.error("Error updating income:", error);
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
