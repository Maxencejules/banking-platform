import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  private base = environment.apiBaseUrl;
  private accountsUrl = `${this.base}/accounts`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Account[]> {
    return this.http.get<Account[]>(this.accountsUrl);
  }

  create(body: CreateAccountRequest): Observable<Account> {
    return this.http.post<Account>(this.accountsUrl, body);
  }

  deposit(id: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`${this.accountsUrl}/${id}/deposit`, { amount });
  }

  withdraw(id: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`${this.accountsUrl}/${id}/withdraw`, { amount });
  }

  freeze(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.accountsUrl}/${id}/freeze`, {});
  }

  unfreeze(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.accountsUrl}/${id}/unfreeze`, {});
  }

  close(id: number): Observable<Account> {
    return this.http.post<Account>(`${this.accountsUrl}/${id}/close`, {});
  }
}
