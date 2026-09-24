/**
 * Typed models for the MJ Banking REST API.
 * Source of truth: docs/API.md.
 */

/** ISO-8601 UTC instant, e.g. `2026-09-24T14:03:11.123Z`. */
export type Instant = string;
/** ISO local date, e.g. `2026-09-24`. */
export type IsoDate = string;

export type Role = 'CUSTOMER' | 'ADMIN';
export type AccountType = 'CHECKING' | 'SAVINGS';
export type Currency = 'CAD' | 'USD';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'INTEREST';

export const ACCOUNT_TYPES: readonly AccountType[] = ['CHECKING', 'SAVINGS'];
export const CURRENCIES: readonly Currency[] = ['CAD', 'USD'];
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['ACTIVE', 'FROZEN', 'CLOSED'];
export const TRANSACTION_TYPES: readonly TransactionType[] = [
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'INTEREST',
];

/* ------------------------------------------------------------------ Auth */

export interface UserResponse {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Instant;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: Instant;
  user: UserResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

/* -------------------------------------------------------------- Accounts */

export interface AccountResponse {
  id: number;
  accountNumber: string;
  nickname: string | null;
  type: AccountType;
  currency: Currency;
  balance: number;
  status: AccountStatus;
  /** Annual rate in percent. */
  interestRate: number;
  dailyWithdrawalLimit: number;
  /** Withdrawals + outgoing transfers today (UTC). */
  withdrawnToday: number;
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  createdAt: Instant;
  updatedAt: Instant;
  closedAt: Instant | null;
}

export interface CreateAccountRequest {
  type: AccountType;
  currency: Currency;
  nickname?: string;
  initialDeposit?: number;
}

export interface UpdateAccountRequest {
  nickname: string;
}

/** Body of deposit / withdraw requests. */
export interface MoneyMovementRequest {
  amount: number;
  description?: string;
}

/* ---------------------------------------------------------- Transactions */

export interface TransactionResponse {
  id: number;
  reference: string;
  type: TransactionType;
  /** Always positive; direction is given by `type`. */
  amount: number;
  balanceAfter: number;
  description: string | null;
  counterpartyAccountNumber: string | null;
  createdAt: Instant;
}

export interface TransactionQuery {
  page?: number;
  size?: number;
  type?: TransactionType | null;
  from?: IsoDate | null;
  to?: IsoDate | null;
}

/* ------------------------------------------------------------- Transfers */

export interface RecipientResponse {
  accountNumber: string;
  /** Masked display name, e.g. `Jordan L.` */
  displayName: string;
  currency: Currency;
}

export interface TransferRequest {
  fromAccountId: number;
  toAccountNumber: string;
  amount: number;
  description?: string;
}

export interface TransferResponse {
  reference: string;
  fromAccount: AccountResponse;
  toAccountNumber: string;
  amount: number;
  currency: Currency;
  description: string | null;
  createdAt: Instant;
}

/* ----------------------------------------------------------------- Admin */

/** Amounts keyed by ISO currency code, e.g. `{ "CAD": 1234.56 }`. */
export type CurrencyAmounts = Record<string, number>;

export interface AdminStats {
  totalCustomers: number;
  totalAccounts: number;
  activeAccounts: number;
  frozenAccounts: number;
  closedAccounts: number;
  depositsByCurrency: CurrencyAmounts;
}

export interface AdminAccountQuery {
  q?: string | null;
  status?: AccountStatus | null;
  page?: number;
  size?: number;
}

export interface AdminUserQuery {
  q?: string | null;
  page?: number;
  size?: number;
}

export interface InterestRunResponse {
  accountsCredited: number;
  totalInterest: CurrencyAmounts;
  runAt: Instant;
}

/* ---------------------------------------------------------------- Common */

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** RFC 7807 problem details. `errors` is present only for validation failures (400). */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}
