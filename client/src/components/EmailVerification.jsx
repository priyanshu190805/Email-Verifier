
import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ResultCard from './ResultCard';

const EmailVerification = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.post('http://localhost:5000/api/verify-email', { email });
            setResult(response.data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to verify email");
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setEmail(suggestion);
        setEmail(suggestion);
    };

    return (
        <div className="container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Email Verifier ✉️</h1>

                <form onSubmit={handleVerify}>
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder="Enter email address..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <div className="spinner"></div> : 'Verify'}
                        </button>
                    </div>
                </form>

                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="error-alert"
                        style={{ color: 'var(--error-color)', marginTop: '10px' }}
                    >
                        {error}
                    </motion.div>
                )}

                <AnimatePresence>
                    {result && <ResultCard result={result} onSuggestionClick={handleSuggestionClick} />}
                </AnimatePresence>

            </motion.div>
        </div>
    );
};

export default EmailVerification;
