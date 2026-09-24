import {
  AccountResponse,
  AuthResponse,
  PageResponse,
  TransactionResponse,
  UserResponse,
} from '../app/core/api/models';
import { AUTH_STORAGE_KEY, AuthSession } from '../app/core/auth/auth.service';

/** Test data factories (used only by *.spec.ts files). */

export const TEST_API = '/api';

export function aUser(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 2,
    email: 'alex@example.com',
    fullName: 'Alex Martin',
    role: 'CUSTOMER',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function anAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'jwt-token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: aUser(),
    ...overrides,
  };
}

/** Writes a valid session to localStorage (call before AuthService is created). */
export function seedSession(user: UserResponse = aUser(), token = 'jwt-token'): AuthSession {
  const session: AuthSession = {
    accessToken: token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function anAccount(overrides: Partial<AccountResponse> = {}): AccountResponse {
  return {
    id: 3,
    accountNumber: '100000000017',
    nickname: 'Everyday',
    type: 'CHECKING',
    currency: 'CAD',
    balance: 1520.35,
    status: 'ACTIVE',
    interestRate: 0,
    dailyWithdrawalLimit: 5000,
    withdrawnToday: 120,
    ownerId: 2,
    ownerName: 'Alex Martin',
    ownerEmail: 'alex@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    closedAt: null,
    ...overrides,
  };
}

export function aTransaction(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    id: 17,
    reference: 'TX-7F3A9C21B4',
    type: 'TRANSFER_OUT',
    amount: 200,
    balanceAfter: 1320.35,
    description: 'Rent share',
    counterpartyAccountNumber: '100000000025',
    createdAt: '2026-09-20T14:03:11.123Z',
    ...overrides,
  };
}

export function aPage<T>(content: T[], overrides: Partial<PageResponse<T>> = {}): PageResponse<T> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    ...overrides,
  };
}
