import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AccountService } from '../../core/api/account.service';
import { AccountResponse, MoneyMovementRequest } from '../../core/api/models';
import { errorMessage, fieldErrorsOf } from '../../core/util/errors';
import { accountDisplayName, roundCents } from '../../core/util/format';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import { DESCRIPTION_MAX, amountValidators } from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { ModalComponent } from '../../shared/modal';

export type MoneyMode = 'deposit' | 'withdraw';

/** Deposit or withdraw dialog for one account. */
@Component({
  selector: 'app-money-dialog',
  imports: [ReactiveFormsModule, ModalComponent, IconComponent, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [heading]="heading()" [busy]="submitting()" (closed)="closed.emit()">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="muted small">
          {{ accountName() }} · Balance
          <strong class="tnum">{{ account().balance | currency: account().currency }}</strong>
          @if (mode() === 'withdraw') {
            · Daily limit left
            <strong class="tnum">{{ remainingLimit() | currency: account().currency }}</strong>
          }
        </p>

        @if (serverError(); as message) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" />
            <span>{{ message }}</span>
          </div>
        }

        @let amountError = fieldError('amount', 'Amount');
        <div class="field">
          <label class="field-label" for="money-amount">Amount</label>
          <div class="input-affix">
            <span class="affix" aria-hidden="true">{{ account().currency }}</span>
            <input
              id="money-amount"
              class="control tnum"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              formControlName="amount"
              placeholder="0.00"
              [attr.aria-invalid]="!!amountError"
              [attr.aria-describedby]="amountError ? 'money-amount-error' : null"
            />
          </div>
          @if (amountError) {
            <p class="field-error" id="money-amount-error">{{ amountError }}</p>
          }
        </div>

        @let descriptionError = fieldError('description', 'Description');
        <div class="field">
          <label class="field-label" for="money-description">
            Description <span class="optional">(optional)</span>
          </label>
          <input
            id="money-description"
            class="control"
            type="text"
            formControlName="description"
            [attr.maxlength]="descriptionMax"
            [placeholder]="mode() === 'deposit' ? 'e.g. Paycheque' : 'e.g. ATM withdrawal'"
            [attr.aria-invalid]="!!descriptionError"
            [attr.aria-describedby]="descriptionError ? 'money-description-error' : null"
          />
          @if (descriptionError) {
            <p class="field-error" id="money-description-error">{{ descriptionError }}</p>
          }
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" [disabled]="submitting()" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            @if (submitting()) {
              <span class="btn-spinner" aria-hidden="true"></span>
            }
            {{ mode() === 'deposit' ? 'Deposit' : 'Withdraw' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class MoneyDialogComponent {
  private readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);

  readonly account = input.required<AccountResponse>();
  readonly mode = input.required<MoneyMode>();
  readonly completed = output<AccountResponse>();
  readonly closed = output<void>();

  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly accountName = computed(() => accountDisplayName(this.account()));
  protected readonly heading = computed(() =>
    this.mode() === 'deposit' ? 'Deposit money' : 'Withdraw money',
  );
  protected readonly remainingLimit = computed(() => {
    const account = this.account();
    return Math.max(0, roundCents(account.dailyWithdrawalLimit - account.withdrawnToday));
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: new FormControl<number | null>(null, [
      ...amountValidators,
      (control: AbstractControl) => this.withdrawalLimits(control),
    ]),
    description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  protected fieldError(name: 'amount' | 'description', label: string): string | null {
    return controlMessage(this.form.controls[name], label, this.submitted(), this.serverFieldErrors()[name]);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    this.form.controls.amount.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    const { amount, description } = this.form.getRawValue();
    const request: MoneyMovementRequest = { amount: roundCents(amount ?? 0) };
    if (description.trim()) {
      request.description = description.trim();
    }

    const account = this.account();
    const call =
      this.mode() === 'deposit'
        ? this.accounts.deposit(account.id, request)
        : this.accounts.withdraw(account.id, request);

    this.submitting.set(true);
    call.subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.completed.emit(updated);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverFieldErrors.set(fieldErrorsOf(error));
        this.serverError.set(
          errorMessage(error, this.mode() === 'deposit' ? 'The deposit failed.' : 'The withdrawal failed.'),
        );
      },
    });
  }

  /** Client-side hints for withdrawals; the server remains the source of truth. */
  private withdrawalLimits(control: AbstractControl): ValidationErrors | null {
    const amount = control.value as number | null;
    // Check the value first: validators also run at construction, before inputs are set.
    if (amount === null || amount <= 0 || this.mode() !== 'withdraw') {
      return null;
    }
    const account = this.account();
    const format = (value: number) =>
      new Intl.NumberFormat(this.locale, { style: 'currency', currency: account.currency }).format(value);
    if (amount > account.balance) {
      return { message: `Insufficient funds. Your balance is ${format(account.balance)}.` };
    }
    if (amount > this.remainingLimit()) {
      return { message: `This exceeds your remaining daily limit of ${format(this.remainingLimit())}.` };
    }
    return null;
  }
}
