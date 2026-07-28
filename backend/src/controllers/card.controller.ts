// backend/src/controllers/card.controller.ts
import type { Request, Response } from "express";
import { pool } from "../db.js";
import { broadcast } from "../sse.js";

export const getCards = async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM cards ORDER BY name ASC;");
    res.status(200).json({ cards: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCard = async (req: Request, res: Response) => {
  try {
    const { name, last_four, type, cutoff_day } = req.body;

    // 1. Create the new card
    const insertQuery = `
      INSERT INTO cards (name, last_four, type, cutoff_day) 
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;
    const result = await pool.query(insertQuery, [
      name,
      last_four,
      type,
      cutoff_day,
    ]);
    const newCard = result.rows[0];

    // 2. THE MAGIC: Retroactive Synchronization!
    // We look for transactions that match the last 4 digits and recalculate their billing_month
    const syncQuery = `
      UPDATE transactions 
      SET 
        card_id = $1,
        billing_month = TO_CHAR(
          date + (CASE WHEN EXTRACT(DAY FROM date) > $2 THEN '1 month'::interval ELSE '0 month'::interval END), 
          'YYYY-MM'
        )
      WHERE card_type LIKE '%' || $3
      AND card_id IS NULL;
    `;

    await pool.query(syncQuery, [newCard.id, cutoff_day, last_four]);

    // 3. Shout through the radio that things changed so React reloads the math!
    broadcast("transaction_updated", {});

    res.status(201).json({
      message: "Card created and old transactions synced!",
      card: newCard,
    });
  } catch (error: any) {
    if (error.code === "23505")
      return res
        .status(409)
        .json({ error: "A card with this last 4 digits already exists." });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteCard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. THE LOGIC: Revert the billing_month of all transactions tied to this card back to their original date
    const revertQuery = `
      UPDATE transactions 
      SET billing_month = TO_CHAR(date, 'YYYY-MM') 
      WHERE card_id = $1;
    `;
    await pool.query(revertQuery, [id]);

    // 2. Now it's safe to delete the card (Postgres will auto-set card_id to NULL thanks to our ON DELETE SET NULL rule)
    await pool.query("DELETE FROM cards WHERE id = $1", [id]);

    // 3. Shout through the radio that things changed so React reloads the math!
    broadcast("transaction_updated", {});

    res
      .status(200)
      .json({ message: "Card deleted and transactions reverted successfully" });
  } catch (error) {
    console.error("Error deleting card:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, last_four, type, cutoff_day } = req.body;

    // 1. Update the card details in the database
    const updateQuery = `
      UPDATE cards 
      SET name = $1, last_four = $2, type = $3, cutoff_day = $4 
      WHERE id = $5 
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
      name,
      last_four,
      type,
      cutoff_day,
      id,
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    // 2. THE SMART SYNC ALGORITHM

    // A. Release: Unlink transactions that were linked by mistake (typo in last_four)
    // We set their card_id to NULL and revert their billing_month back to normal
    const releaseQuery = `
      UPDATE transactions 
      SET card_id = NULL, billing_month = TO_CHAR(date, 'YYYY-MM')
      WHERE card_id = $1 AND card_type NOT LIKE '%' || $2;
    `;
    await pool.query(releaseQuery, [id, last_four]);

    // B. Adopt: Link orphan transactions that match the corrected last_four digits
    const adoptQuery = `
      UPDATE transactions 
      SET card_id = $1
      WHERE card_type LIKE '%' || $2 AND card_id IS NULL;
    `;
    await pool.query(adoptQuery, [id, last_four]);

    // C. Recalculate: Apply the (potentially new) cutoff_day to all linked transactions
    const syncQuery = `
      UPDATE transactions 
      SET 
        billing_month = TO_CHAR(
          date + (CASE WHEN EXTRACT(DAY FROM date) > $1 THEN '1 month'::interval ELSE '0 month'::interval END), 
          'YYYY-MM'
        )
      WHERE card_id = $2;
    `;
    await pool.query(syncQuery, [cutoff_day, id]);

    // 3. Tell React to refresh the UI because the math might have changed heavily!
    broadcast("transaction_updated", {});

    res
      .status(200)
      .json({ message: "Card updated successfully", card: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") {
      res
        .status(409)
        .json({ error: "A card with this last 4 digits already exists." });
      return;
    }
    console.error("Error updating card:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
