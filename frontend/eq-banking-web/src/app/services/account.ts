import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Account {
  id: number;
  accountNumber: string;
  ownerName: string;
  ownerEmail: string;
  balance: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {

  // this will be http://localhost:8081/api/accounts
  private readonly baseUrl = `${environment.apiBaseUrl}/accounts`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Account[]> {
    return this.http.get<Account[]>(this.baseUrl);
  }

  create(payload: {
    ownerName: string;
    ownerEmail: string;
    initialBalance: number;
    currency: string;
  }): Observable<Account> {
    return this.http.post<Account>(this.baseUrl, payload);
  }

  deposit(id: number, amount: number) {
    return this.http.post(`${this.baseUrl}/${id}/deposit`, { amount });
  }

  withdraw(id: number, amount: number) {
    return this.http.post(`${this.baseUrl}/${id}/withdraw`, { amount });
  }

  freeze(id: number) {
    return this.http.post(`${this.baseUrl}/${id}/freeze`, {});
  }

  unfreeze(id: number) {
    return this.http.post(`${this.baseUrl}/${id}/unfreeze`, {});
  }

  close(id: number) {
    return this.http.post(`${this.baseUrl}/${id}/close`, {});
  }
}
