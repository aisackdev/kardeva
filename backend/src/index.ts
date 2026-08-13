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

const allowedOrigins = [
  "http://localhost:5173", // For local dev
  "https://kardeva.app", // For production root domain
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman or curl) or allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

app.use(express.json());

// PUBLIC ROUTES (No token required)
app.use("/api/auth", authRoutes); // <-- Login route
app.use("/", systemRoutes); // Root welcome message

// PRIVATE ROUTES (Protected by verifyToken middleware)
app.use("/api/transactions", verifyToken, transactionRoutes);
app.use("/api/third-parties", verifyToken, thirdPartyRoutes);
app.use("/api/cards", verifyToken, cardRoutes);

// SSE Stream also needs protection (we pass the token in the URL query)
app.get("/api/stream", verifyToken, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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
