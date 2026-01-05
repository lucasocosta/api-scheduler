CREATE TABLE IF NOT EXISTS workflow_tasks (
    id VARCHAR(36) PRIMARY KEY,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    last_error TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Example task for CDB Scheduling
-- INSERT INTO workflow_tasks (id, idempotency_key, type, payload) 
-- VALUES (UUID(), 'unique-key-123', 'AgendamentoCompraCDB', '{"userId": "123", "amount": 1000, "cdbId": "CDB-456"}');
