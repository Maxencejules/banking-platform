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
- Pessimistic row locks taken in a consistent order, so concurrent transfers in opposite
  directions cannot deadlock; DB check constraint forbids negative balances
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
│   └── src/main/resources/db/migration/   Flyway migrations
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
| Tests    | JUnit 5, Spring MockMvc, AssertJ, Mockito; Vitest for Angular |
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

---

## Design notes

- **Ledger first.** `LedgerService` is the only code path that changes a balance, and it requires
  an existing transaction (`Propagation.MANDATORY`), so a balance update is never persisted
  without its ledger entry.
- **Locking.** Money movement loads accounts with `SELECT ... FOR UPDATE`. Transfers lock the two
  accounts in ascending id order to prevent deadlocks, and `@Version` columns add optimistic
  checks on top.
- **Idempotency.** A transfer submitted with an `Idempotency-Key` is stored with a hash of its
  payload. A retry returns the original receipt. Reusing a key with a different payload returns
  `409`.
- **Time.** All business time is UTC and comes from an injectable `Clock`, which keeps daily
  limits and interest runs testable.
- **Errors.** Domain exceptions map to 404/409/422/423, and all error bodies are RFC 7807
  problem documents with field-level `errors` for validation failures.

---

## Author

**Maxence Jules**  
B.Sc. Computer Science Student  
Aspiring Software Engineer

GitHub: https://github.com/Maxencejules

## License

Provided for educational and portfolio purposes.
