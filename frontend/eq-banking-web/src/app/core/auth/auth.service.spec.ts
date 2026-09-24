import type { MockInstance } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TEST_API, aUser, anAuthResponse, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../api/api-config';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';

describe('AuthService', () => {
  let http: HttpTestingController;
  let navigate: MockInstance<Router['navigate']>;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('starts signed out when nothing is stored', () => {
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it('login posts the credentials and stores the token and user', () => {
    const auth = setup();
    const response = anAuthResponse({ user: aUser({ role: 'ADMIN', fullName: 'Ada Admin' }) });

    auth.login({ email: 'admin@mjbank.dev', password: 'Admin123!' }).subscribe();
    const req = http.expectOne(`${TEST_API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@mjbank.dev', password: 'Admin123!' });
    req.flush(response);

    expect(auth.token()).toBe('jwt-token');
    expect(auth.user()?.fullName).toBe('Ada Admin');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    expect(auth.homeUrl()).toBe('/admin');

    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}');
    expect(stored.accessToken).toBe('jwt-token');
    expect(stored.user.email).toBe(response.user.email);
  });

  it('register stores the session like login', () => {
    const auth = setup();
    auth.register({ fullName: 'Alex Martin', email: 'alex@example.com', password: 'Password123' }).subscribe();
    const req = http.expectOne(`${TEST_API}/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush(anAuthResponse(), { status: 201, statusText: 'Created' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.homeUrl()).toBe('/dashboard');
  });

  it('logout clears the token, user and storage and redirects to /login', () => {
    seedSession();
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(true);

    auth.logout();

    expect(auth.token()).toBeNull();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('logout can skip the redirect', () => {
    seedSession();
    const auth = setup();
    auth.logout({ redirect: false });
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores a stored session but discards an expired one', () => {
    seedSession(aUser({ fullName: 'Stored User' }));
    expect(setup().user()?.fullName).toBe('Stored User');

    TestBed.resetTestingModule();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ accessToken: 'old', expiresAt: '2000-01-01T00:00:00Z', user: aUser() }),
    );
    const auth = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{not json');
    expect(setup().isAuthenticated()).toBe(false);
  });

  it('logs out automatically when the token expires', () => {
    vi.useFakeTimers();
    const auth = setup();
    auth.login({ email: 'alex@example.com', password: 'Password123!' }).subscribe();
    http
      .expectOne(`${TEST_API}/auth/login`)
      .flush(anAuthResponse({ expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    expect(auth.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(59_000);
    expect(auth.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('refreshUser updates the stored user', () => {
    seedSession(aUser({ fullName: 'Old Name' }));
    const auth = setup();
    auth.refreshUser().subscribe();
    http.expectOne(`${TEST_API}/auth/me`).flush(aUser({ fullName: 'New Name' }));
    expect(auth.user()?.fullName).toBe('New Name');
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}').user.fullName).toBe('New Name');
  });
});
