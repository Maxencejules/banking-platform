import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { AuthResponse, LoginRequest, RegisterRequest, UserResponse } from '../api/models';
import { readStorage, removeStorage, writeStorage } from '../util/storage';

export const AUTH_STORAGE_KEY = 'mjb.auth';

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: UserResponse;
}

export interface LogoutOptions {
  /** Navigate to /login afterwards (default true). */
  redirect?: boolean;
  /** Shown on the login page, e.g. `expired`. */
  reason?: 'expired' | 'signed-out';
  /** URL to return to after signing in again. */
  returnUrl?: string;
}

/** `setTimeout` delays above 2^31-1 ms fire immediately, so clamp long-lived tokens. */
const MAX_TIMER_DELAY = 2_147_483_647;

function expiryTime(session: AuthSession): number {
  const time = Date.parse(session.expiresAt);
  return Number.isNaN(time) ? 0 : time;
}

function isSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authUrl = `${inject(API_BASE_URL)}/auth`;

  private readonly session = signal<AuthSession | null>(this.restore());
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** The signed-in user, or null. */
  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  /** Landing page after sign-in. */
  readonly homeUrl = computed(() => (this.isAdmin() ? '/admin' : '/dashboard'));

  constructor() {
    const current = this.session();
    if (current) {
      this.scheduleExpiry(current);
    }

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.clearTimer());

    // Keep tabs in sync: signing out in one tab signs out the others.
    if (typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== AUTH_STORAGE_KEY) {
          return;
        }
        const next = this.restore();
        if (!next && this.session()) {
          this.logout({ reason: 'signed-out' });
        } else if (next) {
          this.session.set(next);
          this.scheduleExpiry(next);
        }
      };
      window.addEventListener('storage', onStorage);
      destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
    }
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, request)
      .pipe(tap((response) => this.startSession(response)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/register`, request)
      .pipe(tap((response) => this.startSession(response)));
  }

  /** Re-fetches the current user (e.g. after a reload) and updates the stored copy. */
  refreshUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.authUrl}/me`).pipe(
      tap((user) => {
        const current = this.session();
        if (current) {
          this.persist({ ...current, user });
        }
      }),
    );
  }

  /** Clears the session and (by default) navigates to the login page. */
  logout(options: LogoutOptions = {}): void {
    this.clearTimer();
    removeStorage(AUTH_STORAGE_KEY);
    this.session.set(null);

    if (options.redirect === false) {
      return;
    }
    const queryParams: Record<string, string> = {};
    if (options.reason) {
      queryParams['reason'] = options.reason;
    }
    if (options.returnUrl && options.returnUrl !== '/' && !options.returnUrl.startsWith('/login')) {
      queryParams['returnUrl'] = options.returnUrl;
    }
    void this.router.navigate(['/login'], { queryParams });
  }

  private startSession(response: AuthResponse): void {
    this.persist({
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      user: response.user,
    });
  }

  private persist(session: AuthSession): void {
    writeStorage(AUTH_STORAGE_KEY, JSON.stringify(session));
    this.session.set(session);
    this.scheduleExpiry(session);
  }

  private restore(): AuthSession | null {
    const raw = readStorage(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSession(parsed) && expiryTime(parsed) > Date.now()) {
        return parsed;
      }
    } catch {
      /* corrupted entry */
    }
    removeStorage(AUTH_STORAGE_KEY);
    return null;
  }

  private scheduleExpiry(session: AuthSession): void {
    this.clearTimer();
    const delay = expiryTime(session) - Date.now();
    if (delay <= 0) {
      this.logout({ reason: 'expired', returnUrl: this.router.url });
      return;
    }
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      // Re-evaluates: logs out if expired, otherwise re-arms (long tokens are clamped).
      const current = this.session();
      if (current) {
        this.scheduleExpiry(current);
      }
    }, Math.min(delay, MAX_TIMER_DELAY));
  }

  private clearTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
