import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TEST_API, aUser, anAuthResponse } from '../../../testing/fixtures';
import { API_BASE_URL } from '../../core/api/api-config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent, safeReturnUrl } from './login';

@Component({ template: '' })
class BlankComponent {}

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'dashboard', component: BlankComponent },
          { path: 'admin', component: BlankComponent },
        ]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function input(id: string): HTMLInputElement {
    return el.querySelector(`#${id}`) as HTMLInputElement;
  }

  function type(id: string, value: string): void {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows the demo credentials as a hint', () => {
    const text = el.textContent ?? '';
    expect(text).toContain('admin@mjbank.dev');
    expect(text).toContain('alex@example.com');
    expect(text).toContain('Password123!');
  });

  it('labels every input', () => {
    for (const id of ['login-email', 'login-password']) {
      expect(el.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });

  it('validates on the client before calling the API', async () => {
    await submit();
    expect(el.textContent).toContain('Email is required.');
    expect(el.textContent).toContain('Password is required.');
    http.expectNone(`${TEST_API}/auth/login`);
  });

  it('signs in with a demo account and navigates to the role home page', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const useButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.demo button'));
    useButtons[0]?.click(); // admin
    await fixture.whenStable();
    expect(input('login-email').value).toBe('admin@mjbank.dev');

    await submit();
    const req = http.expectOne(`${TEST_API}/auth/login`);
    expect(req.request.body).toEqual({ email: 'admin@mjbank.dev', password: 'Admin123!' });
    req.flush(anAuthResponse({ user: aUser({ role: 'ADMIN', fullName: 'Ada Admin' }) }));
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).isAdmin()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('shows the ProblemDetail detail from the server on failure', async () => {
    type('login-email', 'alex@example.com');
    type('login-password', 'wrong-password1');
    await submit();

    http
      .expectOne(`${TEST_API}/auth/login`)
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Invalid email or password' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password');
  });

  it('shows the lockout message on 423', async () => {
    type('login-email', 'alex@example.com');
    type('login-password', 'wrong-password1');
    await submit();

    http
      .expectOne(`${TEST_API}/auth/login`)
      .flush({ status: 423, detail: 'Account locked. Try again in 15 minutes.' }, { status: 423, statusText: 'Locked' });
    await fixture.whenStable();

    expect(el.textContent).toContain('Account locked. Try again in 15 minutes.');
  });
});

describe('safeReturnUrl', () => {
  it('only accepts in-app paths', () => {
    expect(safeReturnUrl('/accounts/3')).toBe('/accounts/3');
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('/login?x=1')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
  });
});
