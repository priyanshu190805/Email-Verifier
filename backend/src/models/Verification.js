import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    result: {
        type: String,
        enum: ["valid", "invalid", "unknown"],
        required: true,
    },
    resultcode: {
        type: Number,
        required: true,
    },
    subresult: {
        type: String,
        enum: [
            "mailbox_exists",
            "mailbox_does_not_exist",
            "greylisted",
            "connection_error",
            "typo_detected",
            "syntax_error",
            "dns_error",
        ],
        required: true,
    },
    domain: {
        type: String,
        required: true,
    },
    mxRecords: {
        type: [String],
        default: [],
    },
    executiontime: {
        type: Number,
        required: true,
    },
    didyoumean: {
        type: String,
        default: null,
    },
    error: {
        type: String,
        default: null,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const Verification = mongoose.model("Verification", verificationSchema);

export default Verification;
