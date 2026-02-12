
import { verifyEmail } from "../services/emailVerificationService.js";
import Verification from "../models/Verification.js";

export const verifyEmailController = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const verificationResult = await verifyEmail(email);

        const verification = new Verification(verificationResult);
        await verification.save();

        res.status(200).json(verificationResult);

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
};
