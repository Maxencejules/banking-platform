import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Account {
  id: number;
  accountNumber: string;
  ownerName: string;
  ownerEmail: string;
  balance: number;
  currency: string;
  status: string;
}

export interface CreateAccountRequest {
  ownerName: string;
  ownerEmail: string;
  initialBalance: number;
  currency: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private apiUrl = 'http://localhost:8081/api/accounts';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  create(body: CreateAccountRequest): Observable<Account> {
    return this.http.post<Account>(this.apiUrl, body);
  }

  deposit(id: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/deposit`, { amount });
  }

  withdraw(id: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/withdraw`, { amount });
  }

  freeze(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/freeze`, {});
  }

  unfreeze(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/unfreeze`, {});
  }

  close(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/close`, {});
  }
}
