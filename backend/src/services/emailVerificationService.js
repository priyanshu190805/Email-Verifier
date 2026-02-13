
import dns from "dns";
import net from "net";
import { promisify } from "util";
import { getDidYouMean } from "./typoDetectionService.js";

const resolveMx = promisify(dns.resolveMx);

const SMTP_TIMEOUT = 5000;

export const verifyEmail = async (email) => {
    const result = {
        email,
        result: "unknown",
        resultcode: 3,
        subresult: "unknown",
        domain: "",
        mxRecords: [],
        executiontime: 0,
        didyoumean: null,
        error: null,
        timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    try {
        if (!email || typeof email !== "string") {
            throw new Error("Email is required and must be a string");
        }

        const [localPart, domain] = email.split("@");
        result.domain = domain;

        const typo = getDidYouMean(email);
        if (typo) {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "typo_detected";
            result.didyoumean = typo;
            return result;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

        if (!emailRegex.test(email) || email.includes("..")) {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "syntax_error";
            result.error = "Invalid email format";
            return result;
        }


        if (email.split("@").length > 2) {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "syntax_error";
            result.error = "Multiple @ symbols";
            return result;
        }



        if (localPart.length > 64 || domain.length > 255) {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "syntax_error";
            result.error = "Email parts too long";
            return result;
        }

        try {
            const mxRecords = await resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                result.result = "invalid";
                result.resultcode = 6;
                result.subresult = "dns_error";
                result.error = "No MX records found";
                return result;
            }
            result.mxRecords = mxRecords.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
        } catch (error) {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "dns_error";
            result.error = "DNS lookup failed";
            return result;
        }

        const mxRecord = result.mxRecords[0];
        const smtpResult = await checkSmtp(mxRecord, email);

        result.result = smtpResult.result;
        result.subresult = smtpResult.subresult;

        if (result.result === "valid") result.resultcode = 1;
        else if (result.result === "invalid") result.resultcode = 6;
        else result.resultcode = 3;

        if (result.subresult === "connection_error") {
            result.error = smtpResult.error;
        }

    } catch (error) {
        result.error = error.message;
        if (error.message === "Email is required and must be a string") {
            result.result = "invalid";
            result.resultcode = 6;
            result.subresult = "syntax_error";
        } else {
            if (!result.subresult || result.subresult === "unknown") {
                result.subresult = "connection_error";
                result.resultcode = 3;
            }
        }
    } finally {
        const endTime = Date.now();
        result.executiontime = (endTime - startTime) / 1000;
    }

    return result;
};


const checkSmtp = (mxHost, email) => {
    return new Promise((resolve) => {
        const socket = net.createConnection(25, mxHost);
        let step = 0;
        let response = "";

        const cleanup = () => {
            socket.removeAllListeners();
            socket.destroy();
        };

        socket.setTimeout(SMTP_TIMEOUT, () => {
            cleanup();
            resolve({ result: "unknown", subresult: "connection_error", error: "Connection timed out" });
        });

        socket.on("error", (err) => {
            cleanup();
            resolve({ result: "unknown", subresult: "connection_error", error: err.message });
        });

        socket.on("data", (data) => {
            response = data.toString();
            const code = parseInt(response.substring(0, 3));

            if (step === 0 && code === 220) {
                socket.write(`HELO ${process.env.SMTP_HELLO_DOMAIN || "localhost"}\r\n`);
                step++;
            } else if (step === 1 && code === 250) {
                socket.write(`MAIL FROM:<check@${process.env.SMTP_HELLO_DOMAIN || "localhost"}>\r\n`);
                step++;
            } else if (step === 2 && code === 250) {
                socket.write(`RCPT TO:<${email}>\r\n`);
                step++;
            } else if (step === 3) {
                if (code === 250) {
                    resolve({ result: "valid", subresult: "mailbox_exists", code });
                } else if (code === 550) {
                    resolve({ result: "invalid", subresult: "mailbox_does_not_exist", code });
                } else if (code >= 450 && code < 460) {
                    resolve({ result: "unknown", subresult: "greylisted", code });
                } else {
                    if (code >= 500) {
                        resolve({ result: "invalid", subresult: "mailbox_does_not_exist", code });
                    } else {
                        resolve({ result: "unknown", subresult: "connection_error", code });
                    }
                }

                socket.write("QUIT\r\n");
                cleanup();
            } else {
                resolve({ result: "unknown", subresult: "connection_error", code, error: `Unexpected response at step ${step}: ${response}` });
                cleanup();
            }
        });
    });
};
