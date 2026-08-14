// backend/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import systemRoutes from "./routes/system.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import thirdPartyRoutes from "./routes/thirdParty.routes.js";
import cardRoutes from "./routes/card.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { initDB } from "./db.js";
import { addClient, removeClient } from "./sse.js";
import { verifyToken } from "./middleware/auth.middleware.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// UPGRADED: A cleaner, bulletproof CORS configuration native to the package
app.use(
  cors({
    origin: ["http://localhost:5173", "https://kardeva.app"],
    credentials: true, // Allow cookies and auth headers securely
  }),
);

app.use(express.json());

// PUBLIC ROUTES
app.use("/api/auth", authRoutes);
app.use("/", systemRoutes);

// PRIVATE ROUTES
app.use("/api/transactions", verifyToken, transactionRoutes);
app.use("/api/third-parties", verifyToken, thirdPartyRoutes);
app.use("/api/cards", verifyToken, cardRoutes);

// SSE Stream
app.get("/api/stream", verifyToken, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // NEW: Double-check CORS specifically for the stream (Cloudflare fallback)
  const origin = req.headers.origin;
  if (origin === "https://kardeva.app" || origin === "http://localhost:5173") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // Push the headers down the pipe
  res.flushHeaders();

  // THE MAGIC FIX: Send an immediate blank comment payload.
  // This forces Cloudflare/Nginx to release the buffered headers instantly to the browser!
  res.write(": connected\n\n");

  addClient(res);
  console.log("Client connected to SSE stream");

  req.on("close", () => {
    removeClient(res);
    console.log("Client disconnected");
  });
});

await initDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
