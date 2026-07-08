import "dotenv/config";
import express from "express";
import cors from "cors";
import systemRoutes from "./routes/system.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { initDB } from "./db.js";
import { addClient, removeClient } from "./sse.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

// Routes
app.use("/", systemRoutes);
app.use("/api/transactions", transactionRoutes);

app.get("/api/stream", (req, res) => {
  // Required headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Establish the connection immediately

  addClient(res); // Add user to our list
  console.log("Client connected to SSE stream");

  // If user closes the browser, remove them from the list
  req.on("close", () => {
    removeClient(res);
    console.log("Client disconnected");
  });
});

await initDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
