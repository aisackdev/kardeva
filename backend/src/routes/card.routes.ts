import { Router } from "express";
import {
  getCards,
  createCard,
  deleteCard,
  updateCard,
} from "../controllers/card.controller.js";

const router = Router();
router.get("/", getCards);
router.post("/", createCard);
router.put("/:id", updateCard);
router.delete("/:id", deleteCard);

export default router;
