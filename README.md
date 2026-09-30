# MJ Banking Platform

A full-stack online banking platform built with **Spring Boot 4 (Java 21)** and **Angular 21**.
Customers register, open chequing and savings accounts, move money, send transfers and download
statements. Operations staff get a back-office console to search customers and accounts, freeze
accounts and run monthly interest.

The goal of the project is to model how a real core-banking service behaves: every balance change
is recorded in an immutable ledger, money movement is safe under concurrency and client retries,
and business rules are enforced on the server.

---

## Features

**Customers**
- Registration and login (JWT bearer tokens, BCrypt passwords, lockout after 5 failed attempts)
- Open chequing or savings accounts in CAD or USD, with an optional initial deposit
- Deposits and withdrawals with descriptions; per-account daily withdrawal limit
- Transfers to any account in the bank, with payee confirmation (masked recipient name) and
  `Idempotency-Key` protection against double submission
- Transaction history with type/date filters and pagination
- CSV statements for any date range (up to one year)
- Rename, freeze/unfreeze and close accounts (closing requires a zero balance)

**Back office (ADMIN role)**
- Portfolio stats: customers, accounts by status, deposits per currency
- Search all accounts (number, owner name, email, status) and all users
- Act on any customer account (freeze, unfreeze, close, view history)
- Trigger the monthly savings-interest run (also scheduled for the 1st of each month)

**Engineering**
- Double-entry style ledger: transfers write two entries sharing one reference, each storing the
  running balance
- Pessimistic account row locks taken in ascending id order; DB check constraint forbids
  negative balances
- Luhn check digit on 12-digit account numbers to catch typos
- RFC 7807 `application/problem+json` errors everywhere, including security failures
- Flyway-managed schema, validated by Hibernate at startup
- OpenAPI docs and Swagger UI
- Docker images, docker-compose stack with PostgreSQL, GitHub Actions CI

---

## Architecture

```
banking-platform/
├── backend/account-serv/            Spring Boot API
│   └── src/main/java/com/eqbank/accountserv/
│       ├── domain/                  JPA entities (User, Account, Transaction, ...)
│       ├── repository/              Spring Data repositories + specifications
│       ├── service/                 Business logic (ledger, transfers, interest, auth)
│       ├── security/                JWT issuing/validation, security filter chain
│       ├── web/                     REST controllers
│       ├── dto/                     Request/response records
│       ├── exception/               Domain exceptions + problem-detail mapping
│       ├── bootstrap/               Demo data seeder (dev)
│       └── config/                  Typed configuration, OpenAPI, SPA fallback
│   ├── src/main/java/db/migration/       Java Flyway upgrade guard
│   └── src/main/resources/db/migration/   SQL Flyway migrations
├── frontend/eq-banking-web/         Angular single-page app
├── docs/API.md                      API reference
├── docker-compose.yml               PostgreSQL + API + UI
└── .github/workflows/ci.yml         CI pipeline
```

| Layer    | Technology |
|----------|------------|
| API      | Java 21, Spring Boot 4, Spring MVC, Spring Security (OAuth2 resource server, HS256 JWT), Bean Validation |
| Data     | Spring Data JPA / Hibernate 7, Flyway, H2 (dev/test), PostgreSQL (prod) |
| Docs     | springdoc-openapi (Swagger UI) |
| Frontend | Angular 21 (standalone components, signals), TypeScript, SCSS |
| Tests    | JUnit 5, Spring MockMvc, AssertJ, Mockito; real PostgreSQL concurrency tests; Vitest for Angular |
| Delivery | Docker, docker-compose, nginx, GitHub Actions |

---

## Running locally

### Prerequisites
- Java 21
- Node.js 22+ and npm

### Backend (dev profile, in-memory H2 with demo data)

```bash
cd backend/account-serv
./mvnw spring-boot:run
```

- API: http://localhost:8081/api
- Swagger UI: http://localhost:8081/swagger-ui.html
- H2 console: http://localhost:8081/h2-console (JDBC URL `jdbc:h2:mem:mjbank`, user `sa`)

### Frontend

```bash
cd frontend/eq-banking-web
npm ci
npm start
```

Open http://localhost:4200.

### Demo accounts (dev profile only)

| Role     | Email                | Password       |
|----------|----------------------|----------------|
| Admin    | `admin@mjbank.dev`   | `Admin123!`    |
| Customer | `alex@example.com`   | `Password123!` |
| Customer | `jordan@example.com` | `Password123!` |
| Customer | `priya@example.com`  | `Password123!` (has a frozen account) |

The seeder creates about 90 days of history: payroll, rent, groceries, bills, auto-savings
transfers, transfers between customers and monthly interest.

### Full stack with Docker (PostgreSQL)

```bash
cp .env.example .env      # set POSTGRES_PASSWORD and a random JWT_SECRET (>= 32 chars)
docker compose up --build
```

Open http://localhost:8080. nginx serves the UI and proxies `/api` to the backend.

### Repeatable customer and administrator demo

With the dev API running and its demo administrator seeded, run from the repository root:

```bash
python scripts/demo_api.py
# For the Docker stack:
python scripts/demo_api.py --base-url http://127.0.0.1:8080/api
```

Python 3.10+ and its standard library are enough. The script creates two fresh customers and
accounts on each run, submits four parallel retries of one CAD 25 transfer, checks a payload
conflict and both ledger legs, verifies CAD 75/25 balances, and exercises admin freeze/unfreeze
and customer authorization boundaries. It prints a JSON result and exits unsuccessfully when
an assertion fails. Use a disposable local demo database; the script intentionally adds data.
An existing database needs the demo administrator (or provide `--admin-email` and
`--admin-password`). CI runs the same script against a fresh PostgreSQL database.

---

## Configuration

The `prod` profile reads everything that is environment-specific or secret from environment
variables and refuses to start without them.

| Variable | Description |
|----------|-------------|
| `SPRING_PROFILES_ACTIVE` | `dev` (default) or `prod` |
| `DATABASE_URL` | JDBC URL, e.g. `jdbc:postgresql://db:5432/mjbank` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | Database credentials |
| `JWT_SECRET` | HMAC signing key, at least 32 bytes |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `DEMO_DATA_ENABLED` | Seed demo data into an empty database (`false` by default in prod) |
| `SWAGGER_UI_ENABLED` | Expose Swagger UI and `/v3/api-docs` in prod (`false` by default) |

Product settings live in `application.properties` under `app.banking.*`: daily withdrawal limit
(default 5,000.00), savings rate (2.50% annually, paid monthly) and maximum open accounts
per customer (10).

---

## API

See [docs/API.md](docs/API.md) for the complete reference: endpoints, payloads, business rules
and error codes. Swagger UI shows the same information interactively.

Quick example:

```bash
TOKEN=$(curl -s -X POST localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"Password123!"}' | jq -r .accessToken)

curl -s localhost:8081/api/accounts -H "Authorization: Bearer $TOKEN" | jq
```

---

## Testing

```bash
cd backend/account-serv && ./mvnw verify          # unit, API and concurrency tests
cd frontend/eq-banking-web && npx ng test --watch=false
```

Backend tests cover domain rules, authentication and lockout, authorization boundaries between
customers, validation, daily limits, transfer rules, idempotent replay, CSV output, interest
calculation across month boundaries, and concurrency. The concurrency tests fire parallel
withdrawals and opposing transfers and assert that no account is overdrawn and no money is
created or lost.

The default backend suite uses H2 for quick local checks. H2's PostgreSQL compatibility mode
does not establish PostgreSQL locking behavior. H2 is explicitly set to 2.5.250 to fix the
[cross-connection CHECK regression](https://github.com/h2database/h2database/issues/4308)
in 2.4.240, as listed in the [upstream release notes](https://github.com/h2database/h2database/releases/tag/version-2.5.250).
The upgrade fixtures keep separate JDBC connections to exercise that behavior.
To run the entire suite plus the PostgreSQL-only
API regressions, create a dedicated empty test database and supply its connection settings:

```bash
cd backend/account-serv
export SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/banking_test
export SPRING_DATASOURCE_USERNAME=bank_test
export SPRING_DATASOURCE_PASSWORD=bank_test
export BANKING_POSTGRES_TESTS=true
./mvnw verify
```

The PostgreSQL regressions refuse to run on H2. They hold an account lock until
`pg_stat_activity` confirms that every parallel API request is waiting on a database row lock,
then verify same-key replay, conflicting payloads, opposite-direction keyed transfers, rollback
after rejection, exactly two ledger legs per transfer, and each account's running ledger
balance. Upgrade fixtures migrate actual V1 data, preserve valid legacy receipts and keys,
and reject ambiguous references before changing ledger rows or column widths. They run on
H2 and in the PostgreSQL jobs. CI runs these checks and the API demo on PostgreSQL 16 and 17
(the Docker stack uses 17); the frontend job covers customer retry/receipt behavior and
administrator action success/failure states.

---

## Design notes

- **Ledger first.** `LedgerService` is the only code path that changes a balance, and it requires
  an existing transaction (`Propagation.MANDATORY`), so a balance update is never persisted
  without its ledger entry.
- **Locking.** Money movement row-locks accounts. Transfers lock the two accounts in ascending
  id order; the locking query does not also lock their owners. `@Version` columns add optimistic
  checks on top. Keyed transfers first lock the caller's user row, so other keyed transfers by
  that caller wait before checking the key. This works across API instances sharing one database.
- **Idempotency.** A transfer submitted with an `Idempotency-Key` is stored with a hash of its
  payload in the same transaction as both ledger legs. A retry returns the original transfer
  reference and details with the current `fromAccount` view. Reusing a key with a different
  payload returns `409`. Transfer transactions explicitly use `READ_COMMITTED`, so a key lookup
  after waiting sees the preceding commit. Failed transfers roll back the key and all money
  movement; a later funded retry can succeed.
- **References and upgrades.** New ledger references retain the complete random UUID.
  The database rejects duplicate `(reference, type)` legs, and replay only reads an outgoing
  receipt owned by the caller. V2 widens reference columns without rewriting V1 or old receipts.
  Its preflight permits one deposit, withdrawal or interest leg, or one outgoing/incoming pair
  with equal amount and currency on different accounts. Ambiguous or unpaired old references
  stop startup with the conflicting reference;
  reconcile the existing history explicitly before retrying. The migration never deletes or
  renumbers ledger rows. Stop all money-writing app instances, including old versions, before
  applying schema upgrades.
- **Time.** All business time is UTC and comes from an injectable `Clock`, which keeps daily
  limits and interest runs testable.
- **Errors.** Domain exceptions map to 404/409/422/423, and all error bodies are RFC 7807
  problem documents with field-level `errors` for validation failures.

---

## Scope and limits

This is a portfolio banking simulation, with customer/admin authorization and transactional
money movement. Deposits and initial funding are simulated, with no external settlement or
bank integrations. Transfers have balanced debit/credit legs; this is not a complete general
ledger. Ledger fields are append-only through the application, not protected from direct
database administrator changes.

Idempotency applies to transfers only, requires a header, is scoped to the authenticated user,
and retains successful keys without expiry. Amount scale is normalized (`40` and `40.00` replay
the same transfer); description text remains part of the payload hash. Different keys for one
user are deliberately serialized as a simple correctness tradeoff. The UI keeps an attempt's
key during retries on the review screen; a reload or a newly edited attempt creates a new key.
The tests demonstrate bounded concurrent behavior on one database, not failover, load capacity,
or a production security/compliance review.

---

## Author

**Maxence Jules**  
B.Sc. Computer Science Student  
Aspiring Software Engineer

GitHub: https://github.com/Maxencejules

## License

Provided for educational and portfolio purposes.
