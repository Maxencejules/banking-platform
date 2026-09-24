import { AccountResponse, AccountStatus, AccountType, TransactionType } from '../api/models';

/** `100000000017` → `•••• 0017` */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) {
    return '';
  }
  return `•••• ${accountNumber.slice(-4)}`;
}

/** `100000000017` → `1000 0000 0017` for readability. */
export function groupAccountNumber(accountNumber: string | null | undefined): string {
  return (accountNumber ?? '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

const TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Chequing',
  SAVINGS: 'Savings',
};

export function accountTypeLabel(type: AccountType): string {
  return TYPE_LABELS[type];
}

export function accountDisplayName(account: Pick<AccountResponse, 'nickname' | 'type'>): string {
  const nickname = account.nickname?.trim();
  return nickname ? nickname : `${accountTypeLabel(account.type)} account`;
}

const STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  FROZEN: 'Frozen',
  CLOSED: 'Closed',
};

export function statusLabel(status: AccountStatus): string {
  return STATUS_LABELS[status];
}

const TRANSACTION_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  INTEREST: 'Interest',
};

export function transactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_LABELS[type];
}

/** Credits increase the balance; debits decrease it. `amount` itself is always positive. */
export function isCredit(type: TransactionType): boolean {
  return type === 'DEPOSIT' || type === 'TRANSFER_IN' || type === 'INTEREST';
}

/** Signed amount for display (`-200` for a debit). */
export function signedAmount(tx: { type: TransactionType; amount: number }): number {
  return isCredit(tx.type) ? tx.amount : -tx.amount;
}

/** Local calendar date as `YYYY-MM-DD` (value format of `<input type="date">`). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function firstDayOfMonth(date = new Date()): string {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function today(): string {
  return toIsoDate(new Date());
}

export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Rounds to cents to avoid binary floating point artefacts (e.g. 0.1 + 0.2). */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
