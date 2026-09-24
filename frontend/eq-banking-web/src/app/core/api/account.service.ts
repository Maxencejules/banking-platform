import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, toHttpParams } from './api-config';
import {
  AccountResponse,
  CreateAccountRequest,
  IsoDate,
  MoneyMovementRequest,
  PageResponse,
  TransactionQuery,
  TransactionResponse,
} from './models';

export const DEFAULT_PAGE_SIZE = 20;

/** Query params for `GET /accounts/{id}/transactions`. Optional filters are omitted when empty. */
export function transactionQueryParams(query: TransactionQuery = {}): HttpParams {
  return toHttpParams({
    page: query.page ?? 0,
    size: query.size ?? DEFAULT_PAGE_SIZE,
    type: query.type,
    from: query.from,
    to: query.to,
  });
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/accounts`;

  /** The caller's accounts, newest first. */
  list(): Observable<AccountResponse[]> {
    return this.http.get<AccountResponse[]>(this.baseUrl);
  }

  get(id: number): Observable<AccountResponse> {
    return this.http.get<AccountResponse>(this.url(id));
  }

  create(request: CreateAccountRequest): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.baseUrl, request);
  }

  rename(id: number, nickname: string): Observable<AccountResponse> {
    return this.http.patch<AccountResponse>(this.url(id), { nickname });
  }

  deposit(id: number, request: MoneyMovementRequest): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.url(id, 'deposit'), request);
  }

  withdraw(id: number, request: MoneyMovementRequest): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.url(id, 'withdraw'), request);
  }

  freeze(id: number): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.url(id, 'freeze'), null);
  }

  unfreeze(id: number): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.url(id, 'unfreeze'), null);
  }

  close(id: number): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.url(id, 'close'), null);
  }

  transactions(id: number, query: TransactionQuery = {}): Observable<PageResponse<TransactionResponse>> {
    return this.http.get<PageResponse<TransactionResponse>>(this.url(id, 'transactions'), {
      params: transactionQueryParams(query),
    });
  }

  /** CSV statement for an inclusive date range, fetched as a Blob so the auth header is sent. */
  statement(id: number, from: IsoDate, to: IsoDate): Observable<Blob> {
    return this.http.get(this.url(id, 'statement'), {
      params: toHttpParams({ from, to }),
      responseType: 'blob',
    });
  }

  private url(id: number, action?: string): string {
    const base = `${this.baseUrl}/${encodeURIComponent(String(id))}`;
    return action ? `${base}/${action}` : base;
  }
}
