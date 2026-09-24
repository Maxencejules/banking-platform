import type { MockInstance } from 'vitest';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TEST_API, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../api/api-config';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let navigate: MockInstance<Router['navigate']>;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('adds the bearer token to API requests', () => {
    seedSession(undefined, 'abc.def.ghi');
    setup();

    http.get(`${TEST_API}/accounts`).subscribe();
    const req = backend.expectOne(`${TEST_API}/accounts`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
    req.flush([]);
  });

  it('does not add a header when signed out', () => {
    setup();
    http.post(`${TEST_API}/auth/login`, {}).subscribe();
    const req = backend.expectOne(`${TEST_API}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('never sends the token to other origins', () => {
    seedSession();
    setup();
    http.get('https://example.com/data').subscribe();
    const req = backend.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('signs out and redirects to /login on 401', () => {
    seedSession();
    setup();
    const logout = vi.spyOn(auth, 'logout');
    const errors: number[] = [];

    http.get(`${TEST_API}/accounts`).subscribe({ error: (e: { status: number }) => errors.push(e.status) });
    backend
      .expectOne(`${TEST_API}/accounts`)
      .flush({ status: 401, detail: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(errors).toEqual([401]);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('does not sign out on a 401 from /auth/login (bad credentials)', () => {
    seedSession();
    setup();
    const logout = vi.spyOn(auth, 'logout');

    http.post(`${TEST_API}/auth/login`, {}).subscribe({ error: () => undefined });
    backend
      .expectOne(`${TEST_API}/auth/login`)
      .flush({ detail: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('passes other errors through without signing out', () => {
    seedSession();
    setup();
    const logout = vi.spyOn(auth, 'logout');

    http.post(`${TEST_API}/accounts/3/withdraw`, {}).subscribe({ error: () => undefined });
    backend
      .expectOne(`${TEST_API}/accounts/3/withdraw`)
      .flush({ detail: 'Insufficient funds' }, { status: 422, statusText: 'Unprocessable Entity' });

    expect(logout).not.toHaveBeenCalled();
  });
});
