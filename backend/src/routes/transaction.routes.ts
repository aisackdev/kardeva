import { Router } from "express";
import {
  createTransaction,
  getTransactions,
  getSummary,
  getChartData,
} from "../controllers/transaction.controller.js";

const router = Router();

router.get("/summary", getSummary);
router.get("/chart", getChartData);

router.post("/", createTransaction);
router.get("/", getTransactions);

export default router;
