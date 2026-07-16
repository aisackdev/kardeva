import type { Request, Response } from "express";
import { pool } from "../db.js";

// Get all third parties to show them in a dropdown in React
export const getThirdParties = async (req: Request, res: Response) => {
  try {
    const selectQuery = "SELECT * FROM third_parties ORDER BY name ASC;";
    const result = await pool.query(selectQuery);

    res.status(200).json({ thirdParties: result.rows });
  } catch (error) {
    console.error("Error fetching third parties:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Add a new third party (e.g. "Mom", "Brother")
export const createThirdParty = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const insertQuery = `
      INSERT INTO third_parties (name) 
      VALUES ($1) 
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [name]);

    res.status(201).json({
      message: "Third party added successfully",
      thirdParty: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error creating third party:", error);

    // Postgres code 23505 means UNIQUE constraint violation
    if (error.code === "23505") {
      res.status(409).json({ error: "This name already exists." });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// NEW: Update a person's name
export const updateThirdParty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updateQuery = `
      UPDATE third_parties 
      SET name = $1 
      WHERE id = $2 
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [name, id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    res.status(200).json({ thirdParty: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "This name already exists." });
      return;
    }
    console.error("Error updating third party:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// NEW: Delete a person
export const deleteThirdParty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. NEW: Before deleting the person, revert their transactions to personal expenses
    const revertTransactionsQuery = `
      UPDATE transactions 
      SET is_third_party = false 
      WHERE third_party_id = $1;
    `;
    await pool.query(revertTransactionsQuery, [id]);

    // 2. Now it's safe to delete the person
    const deleteQuery = "DELETE FROM third_parties WHERE id = $1 RETURNING *;";
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    res.status(200).json({ message: "Person deleted successfully" });
  } catch (error) {
    console.error("Error deleting third party:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
