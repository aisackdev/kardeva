import { Router } from "express";
import {
  getThirdParties,
  createThirdParty,
  updateThirdParty,
  deleteThirdParty,
} from "../controllers/thirdParty.controller.js";

const router = Router();

router.get("/", getThirdParties);
router.post("/", createThirdParty);
router.put("/:id", updateThirdParty);
router.delete("/:id", deleteThirdParty);

export default router;
