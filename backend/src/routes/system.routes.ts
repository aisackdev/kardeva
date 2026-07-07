import { Router } from "express";
import {
  getWelcomeMessage,
  getDatabaseStatus,
} from "../controllers/system.controller.js";

const router = Router();

// Route definitions
router.get("/", getWelcomeMessage);
router.get("/api/db-status", getDatabaseStatus);

export default router;
