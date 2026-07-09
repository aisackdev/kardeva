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
    } = req.body;

    // 2. We write the SQL query using placeholders ($1, $2, etc.) for security
    const insertQuery = `
      INSERT INTO transactions (merchant, location, date, card_type, auth_code, amount, is_third_party, third_party_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    // We order by date descending (newest first)
    const selectQuery = `
      SELECT t.*, p.name as third_party_name 
      FROM transactions t
      LEFT JOIN third_parties p ON t.third_party_id = p.id
      ORDER BY t.date DESC 
      LIMIT 10;
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
    // COALESCE prevents returning NULL if there are no transactions (returns 0 instead)
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE is_third_party = false), 0) AS personal_expenses,
        COALESCE(SUM(amount) FILTER (WHERE is_third_party = true), 0) AS third_party_expenses
      FROM transactions;
    `;

    const result = await pool.query(summaryQuery);
    const personal = parseFloat(result.rows[0].personal_expenses);
    const thirdParty = parseFloat(result.rows[0].third_party_expenses);

    res.status(200).json({
      // Backward compatibility: we send the sum so the current React doesn't crash
      totalExpenses: personal + thirdParty,
      // New precise data for our next step
      personalExpenses: personal,
      thirdPartyExpenses: thirdParty,
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

export const updateTransactionAssignment = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { is_third_party, third_party_id } = req.body;

    const updateQuery = `
      UPDATE transactions 
      SET is_third_party = $1, third_party_id = $2 
      WHERE id = $3 
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
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
      message: "Transaction assigned successfully",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Error assigning transaction:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
