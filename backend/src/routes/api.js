
import express from "express";
import { verifyEmailController } from "../controllers/verificationController.js";

const router = express.Router();

router.post("/verify-email", verifyEmailController);

export default router;
