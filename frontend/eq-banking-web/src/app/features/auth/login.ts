import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrorsOf, problemOf } from '../../core/util/errors';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import { EMAIL_MAX } from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { AuthLayoutComponent } from './auth-layout';

export interface DemoCredential {
  role: string;
  email: string;
  password: string;
}

/** Seeded demo users (dev profile only) — see docs/API.md. */
export const DEMO_CREDENTIALS: readonly DemoCredential[] = [
  { role: 'Admin', email: 'admin@mjbank.dev', password: 'Admin123!' },
  { role: 'Customer', email: 'alex@example.com', password: 'Password123!' },
  { role: 'Customer', email: 'jordan@example.com', password: 'Password123!' },
];

/** Accepts only in-app absolute paths to avoid open redirects. */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return null;
  }
  return value;
}

function loginErrorMessage(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : -1;
  const detail = problemOf(error)?.detail;
  if (status === 401) {
    return detail ?? 'Invalid email or password.';
  }
  if (status === 423) {
    return detail ?? 'Too many failed attempts. Sign-in is locked for 15 minutes.';
  }
  return errorMessage(error, 'Sign-in failed. Please try again.');
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './auth-forms.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly demoCredentials = DEMO_CREDENTIALS;
  protected readonly emailMax = EMAIL_MAX;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX)]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly notice = computed(() => {
    switch (this.queryParams().get('reason')) {
      case 'expired':
        return 'Your session has expired. Please sign in again.';
      case 'signed-out':
        return 'You were signed out.';
      default:
        return null;
    }
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  protected fieldError(name: 'email' | 'password', label: string): string | null {
    return controlMessage(
      this.form.controls[name],
      label,
      this.submitted(),
      this.serverFieldErrors()[name],
    );
  }

  protected useDemo(credential: DemoCredential): void {
    this.form.setValue({ email: credential.email, password: credential.password });
    this.serverError.set(null);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.toast.success(`Welcome back, ${response.user.fullName.split(' ')[0]}!`);
        const target = safeReturnUrl(this.queryParams().get('returnUrl')) ?? this.auth.homeUrl();
        void this.router.navigateByUrl(target);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverFieldErrors.set(fieldErrorsOf(error));
        this.serverError.set(loginErrorMessage(error));
      },
    });
  }
}
