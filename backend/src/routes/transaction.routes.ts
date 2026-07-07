import { Router } from "express";
import {
  createTransaction,
  getTransactions,
  getSummary,
} from "../controllers/transaction.controller.js";

const router = Router();

router.post("/", createTransaction);
router.get("/", getTransactions);
router.get("/summary", getSummary);

export default router;
