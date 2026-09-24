import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, toHttpParams } from './api-config';
import { RecipientResponse, TransferRequest, TransferResponse } from './models';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/transfers`;

  lookupRecipient(accountNumber: string): Observable<RecipientResponse> {
    return this.http.get<RecipientResponse>(`${this.baseUrl}/recipient`, {
      params: toHttpParams({ accountNumber }),
    });
  }

  /**
   * Sends a transfer. Replaying the same `idempotencyKey` returns the original result
   * without moving money again, so retries of the same attempt must reuse the key.
   */
  transfer(request: TransferRequest, idempotencyKey: string): Observable<TransferResponse> {
    return this.http.post<TransferResponse>(this.baseUrl, request, {
      headers: new HttpHeaders({ [IDEMPOTENCY_HEADER]: idempotencyKey }),
    });
  }
}
