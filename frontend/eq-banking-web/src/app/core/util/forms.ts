import { AbstractControl } from '@angular/forms';
import { describeErrors } from './validators';

/** Moves focus to the first invalid form control inside `root` (after a failed submit). */
export function focusFirstInvalid(root: HTMLElement): void {
  const invalid = root.querySelector<HTMLElement>(
    'input.ng-invalid, select.ng-invalid, textarea.ng-invalid, [aria-invalid="true"]',
  );
  invalid?.focus();
}

/**
 * Message to display under a control: a server-side message wins, otherwise the first
 * client-side validation error once the control was touched or the form was submitted.
 */
export function controlMessage(
  control: AbstractControl,
  label: string,
  submitted: boolean,
  serverMessage?: string | null,
): string | null {
  if (serverMessage) {
    return serverMessage;
  }
  if (!(control.touched || submitted) || control.valid) {
    return null;
  }
  return describeErrors(control.errors, label);
}
