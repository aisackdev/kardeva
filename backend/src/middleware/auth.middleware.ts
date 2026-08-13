import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 1. Let Google Apps Script pass if it has the correct API Key
  const apiKey = req.headers["x-api-key"];
  if (apiKey && apiKey === process.env.BOT_API_KEY) {
    return next();
  }

  // 2. Check for the JWT token from the React Frontend
  // It can come in the Headers (Authorization: Bearer <token>) or in the URL query (for SSE stream)
  const token = req.headers.authorization?.split(" ")[1] || req.query.token;

  if (!token) {
    res.status(403).json({ error: "Access denied. No token provided." });
    return;
  }

  try {
    // Verify the token
    jwt.verify(token as string, process.env.JWT_SECRET || "fallback_secret");
    next(); // Valid! Let the user pass
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};
