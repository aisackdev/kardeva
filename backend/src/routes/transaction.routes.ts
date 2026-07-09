import { Router } from "express";
import {
  createTransaction,
  getTransactions,
  getSummary,
  getChartData,
  updateTransactionAssignment,
} from "../controllers/transaction.controller.js";

const router = Router();

router.get("/summary", getSummary);
router.get("/chart", getChartData);

router.post("/", createTransaction);
router.get("/", getTransactions);
router.patch("/:id/assign", updateTransactionAssignment);

export default router;
