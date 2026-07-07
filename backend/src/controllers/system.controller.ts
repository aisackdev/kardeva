import type { Request, Response } from "express";
import { pool } from "../db.js";

// Controller for the root route "/"
export const getWelcomeMessage = (req: Request, res: Response) => {
  res.send("Express backend and TypeScript are working! 🚀");
};

// Controller for the database status route "/api/db-status"
export const getDatabaseStatus = async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Successful connection to the database",
      serverTime: result.rows[0].now,
    });
  } catch (error) {
    console.log("There was an error consulting the database", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
