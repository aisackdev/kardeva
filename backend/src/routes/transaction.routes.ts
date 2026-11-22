import { Router } from "express";
import {
  createTransaction,
  getTransactions,
  getSummary,
  getChartData,
  updateRecentTransaction,
  getIncomes,
  deleteTransaction,
  updateTransactionDetails,
  getFixedExpenses,
  copyPreviousFixedExpenses,
} from "../controllers/transaction.controller.js";

const router = Router();

router.get("/summary", getSummary);
router.get("/chart", getChartData);
router.get("/incomes", getIncomes);
router.get("/fixed-expenses", getFixedExpenses);
router.post("/fixed-expenses/copy-previous", copyPreviousFixedExpenses);

router.post("/", createTransaction);
router.get("/", getTransactions);
router.patch("/:id/edit", updateRecentTransaction);
router.put("/:id", updateTransactionDetails);
router.delete("/:id", deleteTransaction);

export default router;
