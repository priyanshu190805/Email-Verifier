
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import dns from 'dns'; // Use default import as in service
import net from 'net';
import { EventEmitter } from 'events';
import { verifyEmail } from "../src/services/emailVerificationService.js";
import { getDidYouMean } from "../src/services/typoDetectionService.js";

// Helper to mock SMTP socket
function mockSmtpSocket(responses = []) {
    const socket = new EventEmitter();
    socket.write = mock.fn((data) => {
        const nextResponse = responses.shift();
        if (nextResponse) {
            process.nextTick(() => socket.emit("data", nextResponse));
        }
    });
    socket.destroy = mock.fn();
    socket.setTimeout = mock.fn((time, callback) => {
        socket.timeoutCallback = callback;
    });
    socket.removeAllListeners = mock.fn();
    return socket;
}

describe("Email Verification & Typo Detection (Node Test Runner)", () => {

    // Setup mocks before tests
    // Note: mock.method modifies the object in place
    let resolveMxMock;
    let createConnectionMock;

    beforeEach(() => {
        // Reset mocks if needed or re-create
        if (resolveMxMock) resolveMxMock.mock.restore();
        if (createConnectionMock) createConnectionMock.mock.restore();

        // Mock dns.resolveMx
        resolveMxMock = mock.method(dns, 'resolveMx', (domain, callback) => {
            // Default behavior: empty or error unless overridden in test
            callback(null, []);
        });

        // Mock net.createConnection
        createConnectionMock = mock.method(net, 'createConnection', () => {
            return new EventEmitter();
        });
    });

    afterEach(() => {
        resolveMxMock.mock.restore();
        createConnectionMock.mock.restore();
    });

    // --- Part 1: Syntax Validation Tests ---
    describe("Syntax Validation", () => {
        it("1. Should reject missing @ symbol", async () => {
            const res = await verifyEmail("missingat.com");
            assert.strictEqual(res.result, "invalid");
            assert.strictEqual(res.subresult, "syntax_error");
        });

        it("2. Should reject multiple @ symbols", async () => {
            const res = await verifyEmail("user@@gmail.com");
            assert.strictEqual(res.result, "invalid");
        });

        it("3. Should reject double dots in domain", async () => {
            const res = await verifyEmail("user@gmail..com");
            assert.strictEqual(res.result, "invalid");
        });

        it("4. Should reject very long local part", async () => {
            const longLocal = "a".repeat(65);
            const res = await verifyEmail(`${longLocal}@gmail.com`);
            assert.strictEqual(res.result, "invalid");
        });

        it("5. Should handle empty string input", async () => {
            const res = await verifyEmail("");
            assert.strictEqual(res.error, "Email is required and must be a string");
        });
    });

    // --- Part 2: Typo Detection Tests ---
    describe("Typo Detection", () => {
        it("6. Should detect 'gmial.com' typo", async () => {
            const res = await verifyEmail("user@gmial.com");
            assert.strictEqual(res.result, "invalid");
            assert.strictEqual(res.subresult, "typo_detected");
            assert.strictEqual(res.didyoumean, "user@gmail.com");
            assert.strictEqual(res.domain, "gmial.com");
        });

        it("7. Should detect 'yahooo.com' typo", async () => {
            const res = await verifyEmail("user@yahooo.com");
            assert.strictEqual(res.didyoumean, "user@yahoo.com");
        });

        it("8. Should detect 'hotmial.com' typo", async () => {
            const res = await verifyEmail("user@hotmial.com");
            assert.strictEqual(res.didyoumean, "user@hotmail.com");
        });

        it("9. Should NOT flag valid 'gmail.com'", async () => {
            // Mock DNS to return success so it doesn't fail at DNS step
            resolveMxMock.mock.mockImplementation((domain, cb) => {
                cb(null, [{ exchange: "mx.google.com", priority: 10 }]);
            });
            // Mock NET to return immediate close or something simple so it doesn't hang
            createConnectionMock.mock.mockImplementation(() => {
                const s = new EventEmitter();
                s.write = () => { };
                s.destroy = () => { };
                s.setTimeout = () => { };
                s.removeAllListeners = () => { };
                process.nextTick(() => {
                    s.emit('error', new Error("Skip SMTP"));
                });
                return s;
            });

            const res = await verifyEmail("user@gmail.com");
            assert.notStrictEqual(res.subresult, "typo_detected");
        });
    });

    // --- Part 3: DNS & SMTP Logic Tests ---
    describe("SMTP & DNS Logic", () => {

        it("10. Should fail if DNS lookup finds no MX records", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(null, []));
            const res = await verifyEmail("user@valid-syntax.com");
            assert.strictEqual(res.result, "invalid");
            assert.strictEqual(res.subresult, "dns_error");
        });

        it("11. Should return VALID for SMTP 250 response", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(null, [{ exchange: "mx.example.com", priority: 10 }]));

            createConnectionMock.mock.mockImplementation(() => {
                return mockSmtpSocket(["220 Ready", "250 Hello", "250 Sender OK", "250 Recipient OK"]);
            });

            const res = await verifyEmail("user@example.com");
            assert.strictEqual(res.result, "valid");
            assert.strictEqual(res.subresult, "mailbox_exists");
        });

        it("12. Should return INVALID for SMTP 550 response", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(null, [{ exchange: "mx.example.com", priority: 10 }]));

            createConnectionMock.mock.mockImplementation(() => {
                return mockSmtpSocket(["220 Ready", "250 Hello", "250 Sender OK", "550 User Unknown"]);
            });

            const res = await verifyEmail("nonexistent@example.com");
            assert.strictEqual(res.result, "invalid");
            assert.strictEqual(res.subresult, "mailbox_does_not_exist");
        });

        it("13. Should return UNKNOWN for SMTP 450 response", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(null, [{ exchange: "mx.example.com", priority: 10 }]));

            createConnectionMock.mock.mockImplementation(() => {
                return mockSmtpSocket(["220 Ready", "250 Hello", "250 Sender OK", "450 Greylisted"]);
            });

            const res = await verifyEmail("user@example.com");
            assert.strictEqual(res.result, "unknown");
            assert.strictEqual(res.subresult, "greylisted");
        });

        it("14. Should return UNKNOWN on Connection Timeout", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(null, [{ exchange: "mx.example.com", priority: 10 }]));

            let socket;
            createConnectionMock.mock.mockImplementation(() => {
                socket = mockSmtpSocket([]);
                return socket;
            });

            const emailPromise = verifyEmail("user@timeout.com");

            // Wait for socket to be created and setTimeout called
            await new Promise(r => setTimeout(r, 50));

            if (socket && socket.timeoutCallback) {
                socket.timeoutCallback();
            }

            const res = await emailPromise;
            assert.strictEqual(res.subresult, "connection_error");
            assert.strictEqual(res.error, "Connection timed out");
        });

        it("15. DNS Lookup Error exception handled", async () => {
            resolveMxMock.mock.mockImplementation((domain, cb) => cb(new Error("Network Error")));
            const res = await verifyEmail("user@dnsfail.com");
            assert.strictEqual(res.result, "invalid");
            assert.strictEqual(res.subresult, "dns_error");
        });
    });
});
