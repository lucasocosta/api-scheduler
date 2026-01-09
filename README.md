# Resilient Workflow Engine (Effect + MySQL)

A resilient, distributed workflow engine built with **TypeScript** and the **Effect (v3.x)** library, using **MySQL** as the persistence layer.

## 🚀 Key Features

- **Effect-driven Architecture**: Leverages Effect's powerful resource management, error handling, and concurrency primitives.
- **MySQL Queue Pattern**: Uses `SELECT ... FOR UPDATE SKIP LOCKED` for safe, distributed task polling across multiple workers.
- **Idempotency**: Native support for `idempotency_key` to prevent duplicate processing of financial operations.
- **Saga Pattern**: Automatic compensation logic for multi-step workflows.
- **Retry Policies**: Advanced exponential backoff and retry mechanisms for external API calls.
- **Graceful Shutdown**: Ensures all database connections and pending operations are safely closed on interruption.
- **Dockerized**: Ready-to-go environment with Docker and Docker Compose.

## 📁 Project Structure

```text
/domain/errors.ts      # Custom error classes (Data.TaggedError)
/domain/schemas.ts     # Data validation (Effect/Schema)
/services/activities.ts # Atomic workflow steps
/infrastructure        # MySQL Connection Pool & Repo
/workflows/engine.ts   # Core polling and execution logic
/workflows/agendamento.ts # Specific CDB scheduling implementation
```

## 🛠️ Getting Started

### Prerequisites

- Docker and Docker Compose

### Running the Project

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd api-scheduler
   ```

2. **Start the infrastructure and application**:
   ```bash
   docker-compose up --build
   ```

The application will start picking up tasks from the `workflow_tasks` table.

## 🧪 Validation & Testing

To verify the application is working correctly, you can manually insert a task and observe the logs.

1. **Check Logs**:
   ```bash
   docker-compose logs -f app
   ```

2. **Insert Test Task**:
   Run the following command to insert a task into the running database:
   ```bash
   docker exec workflow_db mysql -uroot -proot scheduler -e "INSERT INTO workflow_tasks (id, idempotency_key, type, payload) VALUES (UUID(), 'test-manual-01', 'AgendamentoCompraCDB', '{\"userId\": \"user-123\", \"amount\": 500, \"cdbId\": \"cdb-001\"}');"
   ```

3. **Verify Result**:
   In the log window, you should see messages indicating the task was picked up, processed, and completed.

## 📝 Example Schema

The engine expects a `workflow_tasks` table. See `db/init.sql` for the full schema definition.

## ⚙️ Environment Variables

- `DB_HOST`: MySQL host
- `DB_USER`: MySQL user
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: Database name

## 📄 License

MIT
