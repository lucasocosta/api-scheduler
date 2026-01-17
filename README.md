# Resilient Workflow Engine (Effect + MySQL)

A resilient, distributed workflow engine built with **TypeScript** and the **Effect (v3.x)** library, using **MySQL** as the persistence layer.

## 🚀 Key Features

- **Effect-driven Architecture**: Leverages Effect's powerful resource management, error handling, and concurrency primitives.
- **MySQL Queue Pattern**: Uses `SELECT ... FOR UPDATE SKIP LOCKED` for safe, distributed task polling across multiple workers.
- **Fail-Safe & ID Generation**: Tasks use UUIDs and support idempotency keys to prevent double-processing.
- **Robust Error Handling**:
    - **Transient Errors**: Automatically retried (exponential backoff).
    - **Fatal Errors**: Immediately fail the task and stop retries to avoid infinite loops.
- **Saga Pattern & Compensation**:
    - Tracks `compensation_status` (COMPENSATING, COMPENSATED).
    - Automatically executes compensation steps in reverse order (LIFO) upon workflow failure.
- **Dockerized**: Ready-to-go environment with Docker and Docker Compose.

## 📁 Project Structure

```text
/domain/errors.ts      # Custom error classes (Data.TaggedError)
/domain/schemas.ts     # Data validation (Effect/Schema)
/services/activities.ts # Atomic workflow steps & Simulations
/infrastructure        # MySQL Connection Pool & Repo
/workflows/engine.ts   # Core polling and execution logic
/workflows/agendamento.ts # Specific CDB scheduling workflow
/scripts               # Helper scripts (create tasks, run simulations)
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
   docker compose up --build
   ```
   
   The application will start the Engine, which polls for `PENDING` tasks.

## 🧪 Simulation & Testing

We provide scripts to simulate realistic scenarios (Transient Failures, Fatal Failures, Compensations).

### 1. Create Tasks and Run Simulation

Since the engine polls the database, you first need to populates it with tasks.

1. **Create Tasks**:
   Generates random tasks with status `PENDING`.
   ```bash
   docker compose exec app npm run create-tasks
   ```

2. **Run Tasks**:
   The engine (running in the background) will automatically pick up these tasks. You can watch the logs:
   ```bash
   docker compose logs -f app
   ```

### 2. Manual Simulation (Optional)
If you want to run a specific simulation logic manually (forcing the worker to consume a pending task immediately for testing):

```bash
docker compose exec app npm run simulate
```

### 3. Verification

Observe the logs or query the database to see the states:

*   **Success**: `status` = 'COMPLETED'
*   **Retryable Failure**: Log shows "TRANSIENT ERROR", keeps retrying.
*   **Fatal Failure**: `status` = 'FAILED', `retry_count` = 99 (stops processing), `compensation_status` = 'COMPENSATED' (if compensations ran).

## 📝 Database Schema

The `workflow_tasks` table now supports advanced status tracking:

| Column | Description |
| :--- | :--- |
| `id` | UUID of the task. |
| `status` | PENDING, PROCESSING, COMPLETED, FAILED. |
| `compensation_status` | NONE, COMPENSATING, COMPENSATED. |
| `retry_count` | Number of retries. If 99, it means a Fatal Error occurred. |
| `payload` | JSON payload for the task. |

(See `db/init.sql` for full definition).

## 🔧 Troubleshooting

- **Application Code Updates**:
  If you modify `.ts` files locally, the changes won't reflect in the container automatically because the Dockerfile runs `npm run build`. You must rebuild:
  ```bash
  docker compose exec app npm run build
  docker compose restart app
  ```

- **Infinite Loops**:
  If the engine keeps processing a failed task, ensure it's marked as Fatal. The system logic sets `retry_count` to 99 for non-retryable errors to prevent this.

## ⚙️ Environment Variables

- `DB_HOST`: MySQL host
- `DB_USER`: MySQL user
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: Database name

## 📄 License

MIT
