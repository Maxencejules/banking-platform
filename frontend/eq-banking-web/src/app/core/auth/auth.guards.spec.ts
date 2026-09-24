import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { aUser, seedSession } from '../../../testing/fixtures';
import { adminGuard, authGuard, guestGuard } from './auth.guards';

describe('auth guards', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  function run(guard: typeof authGuard, url: string): MaybeAsync<GuardResult> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.runInInjectionContext(() => guard(route, state(url)));
  }

  function serialize(result: MaybeAsync<GuardResult>): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('redirects anonymous users to /login with a returnUrl', () => {
      expect(serialize(run(authGuard, '/transfer'))).toBe('/login?returnUrl=%2Ftransfer');
    });

    it('allows signed-in users', () => {
      seedSession();
      expect(run(authGuard, '/dashboard')).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('allows anonymous users onto the login page', () => {
      expect(run(guestGuard, '/login')).toBe(true);
    });

    it('sends signed-in customers to their dashboard', () => {
      seedSession(aUser({ role: 'CUSTOMER' }));
      expect(serialize(run(guestGuard, '/login'))).toBe('/dashboard');
    });

    it('sends signed-in admins to the admin page', () => {
      seedSession(aUser({ role: 'ADMIN' }));
      expect(serialize(run(guestGuard, '/register'))).toBe('/admin');
    });
  });

  describe('adminGuard', () => {
    it('allows admins', () => {
      seedSession(aUser({ role: 'ADMIN' }));
      expect(run(adminGuard, '/admin')).toBe(true);
    });

    it('redirects customers to the dashboard', () => {
      seedSession(aUser({ role: 'CUSTOMER' }));
      expect(serialize(run(adminGuard, '/admin'))).toBe('/dashboard');
    });

    it('redirects anonymous users to /login', () => {
      expect(serialize(run(adminGuard, '/admin'))).toBe('/login?returnUrl=%2Fadmin');
    });
  });
});
