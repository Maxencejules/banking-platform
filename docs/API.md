# MJ Banking API Reference

Base URL (local): `http://localhost:8081/api`

Interactive documentation is served by the backend at `/swagger-ui.html`
(OpenAPI JSON at `/v3/api-docs`).

## Conventions

- All request and response bodies are JSON (`Content-Type: application/json`) unless noted.
- Monetary amounts are JSON numbers with at most two decimal places (e.g. `125.50`).
- Timestamps are ISO-8601 UTC instants (e.g. `2026-09-24T14:03:11.123Z`).
- Authenticated endpoints require `Authorization: Bearer <accessToken>`.
- Paged endpoints accept `page` (0-based, default `0`) and `size` (default `20`, max `100`)
  and return a `PageResponse`:

```json
{ "content": [ ... ], "page": 0, "size": 20, "totalElements": 42, "totalPages": 3 }
```

### Errors

Errors use RFC 7807 `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Insufficient funds",
  "instance": "/api/accounts/3/withdraw",
  "errors": { "amount": "must be greater than 0" }
}
```

`errors` is present only for request validation failures (status `400`).

| Status | Meaning |
|-------:|---------|
| 400 | Malformed request or validation failure (`errors` map populated) |
| 401 | Missing/invalid/expired token, or bad credentials on login |
| 403 | Authenticated but not allowed (e.g. another customer's account) |
| 404 | Resource not found |
| 409 | Conflict (email already registered, idempotency key reused with different payload, concurrent update) |
| 422 | Business rule violated (insufficient funds, frozen account, daily limit, ...) |
| 423 | Login temporarily locked after repeated failed attempts |

## Data types

### UserResponse
```json
{ "id": 1, "email": "alex@example.com", "fullName": "Alex Martin", "role": "CUSTOMER", "createdAt": "..." }
```
`role` is `CUSTOMER` or `ADMIN`.

### AuthResponse
```json
{ "accessToken": "eyJ...", "tokenType": "Bearer", "expiresAt": "...", "user": { UserResponse } }
```

### AccountResponse
```json
{
  "id": 3,
  "accountNumber": "100000000017",
  "nickname": "Everyday",
  "type": "CHECKING",
  "currency": "CAD",
  "balance": 1520.35,
  "status": "ACTIVE",
  "interestRate": 0.00,
  "dailyWithdrawalLimit": 5000.00,
  "withdrawnToday": 120.00,
  "ownerId": 2,
  "ownerName": "Alex Martin",
  "ownerEmail": "alex@example.com",
  "createdAt": "...",
  "updatedAt": "...",
  "closedAt": null
}
```
- `type`: `CHECKING` | `SAVINGS`
- `currency`: `CAD` | `USD`
- `status`: `ACTIVE` | `FROZEN` | `CLOSED`
- `interestRate`: annual rate in percent (savings accrue interest monthly).
- `withdrawnToday`: sum of withdrawals and outgoing transfers today (UTC), counted against `dailyWithdrawalLimit`.

### TransactionResponse
```json
{
  "id": 17,
  "reference": "TX-7F3A9C21B4",
  "type": "TRANSFER_OUT",
  "amount": 200.00,
  "balanceAfter": 1320.35,
  "description": "Rent share",
  "counterpartyAccountNumber": "100000000025",
  "createdAt": "..."
}
```
`type`: `DEPOSIT` | `WITHDRAWAL` | `TRANSFER_IN` | `TRANSFER_OUT` | `INTEREST`.
`amount` is always positive; direction is given by `type`.

## Endpoints

### Auth (public)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{ "fullName", "email", "password" }` | `201` AuthResponse |
| POST | `/auth/login` | `{ "email", "password" }` | `200` AuthResponse |
| GET | `/auth/me` | – (auth required) | `200` UserResponse |

Password policy: 8–72 characters with at least one letter and one digit.
After 5 consecutive failed logins the user is locked for 15 minutes (`423`).

### Accounts (customer: own accounts only; admin: any account)

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET | `/accounts` | – | `200` AccountResponse[] (caller's accounts, newest first) |
| POST | `/accounts` | `{ "type", "currency", "nickname"?, "initialDeposit"? }` | `201` AccountResponse |
| GET | `/accounts/{id}` | – | `200` AccountResponse |
| PATCH | `/accounts/{id}` | `{ "nickname" }` | `200` AccountResponse |
| POST | `/accounts/{id}/deposit` | `{ "amount", "description"? }` | `200` AccountResponse |
| POST | `/accounts/{id}/withdraw` | `{ "amount", "description"? }` | `200` AccountResponse |
| POST | `/accounts/{id}/freeze` | – | `200` AccountResponse |
| POST | `/accounts/{id}/unfreeze` | – | `200` AccountResponse |
| POST | `/accounts/{id}/close` | – | `200` AccountResponse |
| GET | `/accounts/{id}/transactions` | `page`, `size`, `type`?, `from`?, `to`? (ISO dates `YYYY-MM-DD`, inclusive) | `200` PageResponse&lt;TransactionResponse&gt; (newest first) |
| GET | `/accounts/{id}/statement` | `from`, `to` (ISO dates) | `200` `text/csv` attachment |

Business rules:
- A customer may hold at most 10 open (non-closed) accounts.
- Deposits, withdrawals and transfers require the account to be `ACTIVE`.
- Maximum single transaction amount: 1,000,000.00. Amounts must be > 0 with ≤ 2 decimals.
- Withdrawals and outgoing transfers are limited by `dailyWithdrawalLimit` per UTC day.
- An account can only be closed when its balance is exactly 0.00. Closing is irreversible.
- Only `ACTIVE` accounts can be frozen; only `FROZEN` accounts can be unfrozen.

### Transfers

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET | `/transfers/recipient` | `accountNumber` | `200` `{ "accountNumber", "displayName", "currency" }` — `displayName` is masked, e.g. `"Jordan L."` |
| POST | `/transfers` | `{ "fromAccountId", "toAccountNumber", "amount", "description"? }`, optional header `Idempotency-Key` | `201` TransferResponse |

TransferResponse:
```json
{
  "reference": "TX-7F3A9C21B4",
  "fromAccount": { AccountResponse },
  "toAccountNumber": "100000000025",
  "amount": 200.00,
  "currency": "CAD",
  "description": "Rent share",
  "createdAt": "..."
}
```
Rules: source must belong to the caller, both accounts `ACTIVE`, same currency, different accounts.
Replaying a request with the same `Idempotency-Key` returns the original result (`201`) without moving money again.

### Admin (role `ADMIN` only)

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/admin/stats` | – | `200` `{ "totalCustomers", "totalAccounts", "activeAccounts", "frozenAccounts", "closedAccounts", "depositsByCurrency": { "CAD": 1234.56 } }` |
| GET | `/admin/accounts` | `q`? (account number, owner name or email), `status`?, `page`, `size` | `200` PageResponse&lt;AccountResponse&gt; |
| GET | `/admin/users` | `q`?, `page`, `size` | `200` PageResponse&lt;UserResponse&gt; |
| POST | `/admin/interest/run` | – | `200` `{ "accountsCredited", "totalInterest": { "CAD": 12.34 }, "runAt" }` |

Admins use the regular `/accounts/{id}/...` endpoints (freeze, unfreeze, close, transactions) on any account.

## Demo credentials (dev profile only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@mjbank.dev` | `Admin123!` |
| Customer | `alex@example.com` | `Password123!` |
| Customer | `jordan@example.com` | `Password123!` |
