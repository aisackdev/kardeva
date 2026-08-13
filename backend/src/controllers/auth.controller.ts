import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const login = (req: Request, res: Response) => {
  const { username, password } = req.body;

  // We read the true credentials from the secure .env file
  const validUsername = process.env.ADMIN_USER;
  const validPassword = process.env.ADMIN_PASS;

  if (username === validUsername && password === validPassword) {
    // Generate a token valid for 7 days
    const token = jwt.sign(
      { user: username },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" },
    );
    res.status(200).json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
};
