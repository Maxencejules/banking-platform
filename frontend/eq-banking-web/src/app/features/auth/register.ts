import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrorsOf, problemOf } from '../../core/util/errors';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import {
  EMAIL_MAX,
  FULL_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordValidators,
} from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { AuthLayoutComponent } from './auth-layout';

type RegisterField = 'fullName' | 'email' | 'password' | 'confirmPassword';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string | undefined;
  const confirm = group.get('confirmPassword');
  if (!confirm) {
    return null;
  }
  const mismatch = !!confirm.value && confirm.value !== password;
  const errors = { ...(confirm.errors ?? {}) };
  if (mismatch) {
    errors['mismatch'] = true;
  } else {
    delete errors['mismatch'];
  }
  confirm.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
  return null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './auth-forms.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly limits = { EMAIL_MAX, FULL_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN };

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.maxLength(FULL_NAME_MAX)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX)]],
      password: ['', passwordValidators],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});

  private readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  /** Live password policy checklist (mirrors the server rule). */
  protected readonly passwordChecks = computed(() => {
    const value = this.password();
    return [
      { label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`, met: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX },
      { label: 'At least one letter', met: /[A-Za-z]/.test(value) },
      { label: 'At least one digit', met: /\d/.test(value) },
    ];
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  protected fieldError(name: RegisterField, label: string): string | null {
    return controlMessage(
      this.form.controls[name],
      label,
      this.submitted(),
      this.serverFieldErrors()[name],
    );
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
    const { fullName, email, password } = this.form.getRawValue();
    this.auth.register({ fullName: fullName.trim(), email: email.trim(), password }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.toast.success(`Welcome to MJ Banking, ${response.user.fullName.split(' ')[0]}!`);
        void this.router.navigateByUrl(this.auth.homeUrl());
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const fieldErrors = fieldErrorsOf(error);
        this.serverFieldErrors.set(fieldErrors);
        const hasFieldErrors = Object.keys(fieldErrors).length > 0;
        this.serverError.set(
          hasFieldErrors && !problemOf(error)?.detail
            ? 'Please correct the highlighted fields.'
            : errorMessage(error, 'Registration failed. Please try again.'),
        );
      },
    });
  }
}
