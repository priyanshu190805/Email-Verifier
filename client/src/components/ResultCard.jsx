
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle, FaQuestionCircle, FaExchangeAlt } from 'react-icons/fa';

const ResultCard = ({ result, onSuggestionClick }) => {
    const {
        result: status,
        subresult,
        domain,
        mxRecords,
        executiontime,
        didyoumean
    } = result;

    const getStatusIcon = () => {
        if (status === 'valid') return <FaCheckCircle color="var(--success-color)" size={24} />;
        if (status === 'invalid') return <FaTimesCircle color="var(--error-color)" size={24} />;
        return <FaQuestionCircle color="var(--warning-color)" size={24} />;
    };

    const getStatusBadge = () => {
        return <span className={`badge badge-${status}`}>{status}</span>;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="result-card"
        >
            {didyoumean && (
                <div className="typo-alert">
                    <FaExchangeAlt />
                    <span>Did you mean </span>
                    <span
                        className="typo-suggestion"
                        onClick={() => onSuggestionClick(didyoumean)}
                    >
                        {didyoumean}
                    </span>?
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                {getStatusIcon()}
                <h2 style={{ margin: 0 }}>Verification Result</h2>
                <div style={{ marginLeft: 'auto' }}>{getStatusBadge()}</div>
            </div>

            <div className="details">
                <div className="detail-row">
                    <span className="label">Reason:</span>
                    <span className="value" style={{ textTransform: 'capitalize' }}>{subresult.replace(/_/g, ' ')}</span>
                </div>
                <div className="detail-row">
                    <span className="label">Domain:</span>
                    <span className="value">{domain}</span>
                </div>
                {mxRecords && mxRecords.length > 0 && (
                    <div className="detail-row">
                        <span className="label">MX Provider:</span>
                        <span className="value">{mxRecords[0]}</span>
                    </div>
                )}
                <div className="detail-row">
                    <span className="label">Time:</span>
                    <span className="value">{executiontime.toFixed(3)}s</span>
                </div>
            </div>

        </motion.div>
    );
};

export default ResultCard;
