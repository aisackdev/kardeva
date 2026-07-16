import type { Request, Response } from "express";
import { pool } from "../db.js";
import { broadcast } from "../sse.js";

export const createTransaction = async (req: Request, res: Response) => {
  try {
    // 1. We extract the data from the request body (req.body)
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

    // 2. We write the SQL query using placeholders ($1, $2, etc.) for security
    const insertQuery = `
      INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, is_third_party, third_party_id, type, is_base)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *; 
    `;
    // 'RETURNING *' tells Postgres to give us back the row it just created

    const values = [
      merchant,
      location,
      date,
      card_type,
      auth_code,
      amount,
      is_third_party || false, // Default to false if not provided
      third_party_id || null, // Default to null if not provided
      type || "EXPENSE",
      is_base || false,
    ];

    // 3. We execute the query
    const result = await pool.query(insertQuery, values);
    const newTransaction = result.rows[0];

    broadcast("new_transaction", newTransaction);

    // 4. We send the created transaction back to the client with a 201 Created status
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
    const selectQuery = `
      SELECT t.*, p.name as third_party_name 
      FROM transactions t
      LEFT JOIN third_parties p ON t.third_party_id = p.id
      WHERE t.type = 'EXPENSE' AND t.is_base = false
      ORDER BY t.date DESC 
      LIMIT 15; 
    `;

    const result = await pool.query(selectQuery);

    res.status(200).json({
      transactions: result.rows,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSummary = async (req: Request, res: Response) => {
  try {
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = false), 0) AS personal_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = false AND is_base = true), 0) AS fixed_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND is_third_party = true), 0) AS third_party_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND is_base = true), 0) AS base_income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND is_base = false), 0) AS extra_income
      FROM transactions;
    `;

    const result = await pool.query(summaryQuery);
    const personal = parseFloat(result.rows[0].personal_expenses);
    const fixed = parseFloat(result.rows[0].fixed_expenses); // <-- NEW
    const thirdParty = parseFloat(result.rows[0].third_party_expenses);
    const baseIncome = parseFloat(result.rows[0].base_income);
    const extraIncome = parseFloat(result.rows[0].extra_income);

    res.status(200).json({
      personalExpenses: personal,
      fixedExpenses: fixed, // <-- NEW
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
    // We use TO_CHAR to format the date as 'YYYY-MM-DD' and group by it
    const chartQuery = `
      SELECT 
        TO_CHAR(date, 'YYYY-MM-DD') as day,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'EXPENSE'
      GROUP BY TO_CHAR(date, 'YYYY-MM-DD')
      ORDER BY day ASC
      LIMIT 7;
    `;

    const result = await pool.query(chartQuery);

    // Parse the total from string to number (Postgres SUM returns a string)
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
    const selectQuery = `SELECT * FROM transactions WHERE type = 'INCOME' ORDER BY date DESC;`;
    const result = await pool.query(selectQuery);
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
    const selectQuery = `SELECT * FROM transactions WHERE type = 'EXPENSE' AND is_base = true ORDER BY date DESC;`;
    const result = await pool.query(selectQuery);
    res.status(200).json({ fixedExpenses: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
