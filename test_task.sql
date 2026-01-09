INSERT INTO workflow_tasks (id, idempotency_key, type, payload) 
VALUES (UUID(), 'test-key-003', 'AgendamentoCompraCDB', '{"userId": "user-123", "amount": 1000, "cdbId": "cdb-001"}');
