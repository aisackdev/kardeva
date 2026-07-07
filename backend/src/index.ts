import "dotenv/config";
import express from "express";
import cors from "cors";
import systemRoutes from "./routes/system.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
