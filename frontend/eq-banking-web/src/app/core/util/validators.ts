import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Server rule: amounts must be > 0, at most 1,000,000.00 and have ≤ 2 decimals. */
export const MAX_TRANSACTION_AMOUNT = 1_000_000;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const NICKNAME_MAX = 40;
export const DESCRIPTION_MAX = 140;
export const FULL_NAME_MAX = 100;
export const EMAIL_MAX = 120;
export const MAX_OPEN_ACCOUNTS = 10;

/** At most `digits` decimal places. Empty values are left to `Validators.required`. */
export function maxDecimals(digits: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const text = String(value);
    if (!/^-?\d*(\.\d+)?(e[+-]?\d+)?$/i.test(text)) {
      return { number: true };
    }
    const decimals = text.includes('.') ? (text.split('.')[1]?.replace(/e.*$/i, '').length ?? 0) : 0;
    return decimals > digits ? { decimals: { max: digits } } : null;
  };
}

/** Password policy: 8–72 characters with at least one letter and one digit. */
export function passwordPolicy(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    const hasLetter = /[A-Za-z]/.test(value);
    const hasDigit = /\d/.test(value);
    return hasLetter && hasDigit ? null : { passwordPolicy: true };
  };
}

export const passwordValidators: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN),
  Validators.maxLength(PASSWORD_MAX),
  passwordPolicy(),
];

/** Required positive money amount with the server's limits. */
export const amountValidators: ValidatorFn[] = [
  Validators.required,
  Validators.min(0.01),
  Validators.max(MAX_TRANSACTION_AMOUNT),
  maxDecimals(2),
];

/** Account numbers are 12 digits (see AccountResponse.accountNumber). */
export const ACCOUNT_NUMBER_PATTERN = /^\d{12}$/;

/** Removes spaces/dashes people use when copying account numbers. */
export function normalizeAccountNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s-]/g, '');
}

export function accountNumberValidator(control: AbstractControl): ValidationErrors | null {
  const value = normalizeAccountNumber(control.value as string | null);
  if (!value) {
    return null;
  }
  return ACCOUNT_NUMBER_PATTERN.test(value) ? null : { accountNumber: true };
}

/** Returns the first human-readable error for a control, or null. */
export function describeErrors(errors: ValidationErrors | null | undefined, label: string): string | null {
  if (!errors) {
    return null;
  }
  if (errors['server']) return String(errors['server']);
  if (errors['message']) return String(errors['message']);
  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength']) {
    return `${label} must be at least ${(errors['minlength'] as { requiredLength: number }).requiredLength} characters.`;
  }
  if (errors['maxlength']) {
    return `${label} must be at most ${(errors['maxlength'] as { requiredLength: number }).requiredLength} characters.`;
  }
  if (errors['passwordPolicy']) return 'Password must contain at least one letter and one digit.';
  if (errors['min']) {
    const min = (errors['min'] as { min: number }).min;
    return min > 0 ? `${label} must be greater than 0.` : `${label} cannot be negative.`;
  }
  if (errors['max']) {
    return `${label} cannot exceed ${(errors['max'] as { max: number }).max.toLocaleString('en-CA')}.`;
  }
  if (errors['decimals']) return `${label} can have at most 2 decimal places.`;
  if (errors['number']) return `${label} must be a number.`;
  if (errors['accountNumber']) return 'Account numbers are exactly 12 digits.';
  if (errors['pattern']) return `${label} has an invalid format.`;
  if (errors['mismatch']) return 'Passwords do not match.';
  if (errors['insufficientFunds']) return 'Amount exceeds the available balance.';
  if (errors['sameAccount']) return 'Choose a different account than the one you are sending from.';
  return `${label} is invalid.`;
}
