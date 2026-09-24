import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DEFAULT_PAGE_SIZE } from './account.service';
import { API_BASE_URL, toHttpParams } from './api-config';
import {
  AccountResponse,
  AdminAccountQuery,
  AdminStats,
  AdminUserQuery,
  InterestRunResponse,
  PageResponse,
  UserResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/admin`;

  stats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/stats`);
  }

  accounts(query: AdminAccountQuery = {}): Observable<PageResponse<AccountResponse>> {
    return this.http.get<PageResponse<AccountResponse>>(`${this.baseUrl}/accounts`, {
      params: toHttpParams({
        q: query.q,
        status: query.status,
        page: query.page ?? 0,
        size: query.size ?? DEFAULT_PAGE_SIZE,
      }),
    });
  }

  users(query: AdminUserQuery = {}): Observable<PageResponse<UserResponse>> {
    return this.http.get<PageResponse<UserResponse>>(`${this.baseUrl}/users`, {
      params: toHttpParams({
        q: query.q,
        page: query.page ?? 0,
        size: query.size ?? DEFAULT_PAGE_SIZE,
      }),
    });
  }

  runInterest(): Observable<InterestRunResponse> {
    return this.http.post<InterestRunResponse>(`${this.baseUrl}/interest/run`, null);
  }
}
