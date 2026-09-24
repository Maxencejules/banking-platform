import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService } from '../../core/api/account.service';
import {
  ACCOUNT_TYPES,
  AccountResponse,
  AccountType,
  CURRENCIES,
  CreateAccountRequest,
  Currency,
} from '../../core/api/models';
import { errorMessage, fieldErrorsOf } from '../../core/util/errors';
import { accountTypeLabel, roundCents } from '../../core/util/format';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import { MAX_TRANSACTION_AMOUNT, NICKNAME_MAX, maxDecimals } from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { ModalComponent } from '../../shared/modal';

type Field = 'type' | 'currency' | 'nickname' | 'initialDeposit';

@Component({
  selector: 'app-open-account-dialog',
  imports: [ReactiveFormsModule, ModalComponent, IconComponent, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal heading="Open a new account" [busy]="submitting()" (closed)="closed.emit()">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (serverError(); as message) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" />
            <span>{{ message }}</span>
          </div>
        }

        <fieldset class="field">
          <legend class="field-label">Account type</legend>
          <div class="segmented">
            @for (type of types; track type) {
              <label>
                <input type="radio" formControlName="type" [value]="type" name="type" />
                {{ typeLabel(type) }}
              </label>
            }
          </div>
          <p class="field-hint">
            @if (form.controls.type.value === 'SAVINGS') {
              Savings accounts earn interest, credited monthly.
            } @else {
              Everyday banking for deposits, withdrawals and transfers.
            }
          </p>
        </fieldset>

        <fieldset class="field">
          <legend class="field-label">Currency</legend>
          <div class="segmented">
            @for (currency of currencies; track currency) {
              <label>
                <input type="radio" formControlName="currency" [value]="currency" name="currency" />
                {{ currency }}
              </label>
            }
          </div>
        </fieldset>

        @let nicknameError = fieldError('nickname', 'Nickname');
        <div class="field">
          <label class="field-label" for="open-nickname">Nickname <span class="optional">(optional)</span></label>
          <input
            id="open-nickname"
            class="control"
            type="text"
            formControlName="nickname"
            placeholder="e.g. Rainy day fund"
            [attr.maxlength]="nicknameMax"
            [attr.aria-invalid]="!!nicknameError"
            [attr.aria-describedby]="nicknameError ? 'open-nickname-error' : null"
          />
          @if (nicknameError) {
            <p class="field-error" id="open-nickname-error">{{ nicknameError }}</p>
          }
        </div>

        @let depositError = fieldError('initialDeposit', 'Initial deposit');
        <div class="field">
          <label class="field-label" for="open-deposit">Initial deposit <span class="optional">(optional)</span></label>
          <div class="input-affix">
            <span class="affix" aria-hidden="true">{{ form.controls.currency.value }}</span>
            <input
              id="open-deposit"
              class="control tnum"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              formControlName="initialDeposit"
              placeholder="0.00"
              [attr.aria-invalid]="!!depositError"
              [attr.aria-describedby]="depositError ? 'open-deposit-error' : 'open-deposit-hint'"
            />
          </div>
          @if (depositError) {
            <p class="field-error" id="open-deposit-error">{{ depositError }}</p>
          } @else {
            <p class="field-hint" id="open-deposit-hint">
              Up to {{ maxAmount | currency: form.controls.currency.value : 'symbol' : '1.0-0' }}.
            </p>
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
            Open account
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class OpenAccountDialogComponent {
  private readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly created = output<AccountResponse>();
  readonly closed = output<void>();

  protected readonly types = ACCOUNT_TYPES;
  protected readonly currencies = CURRENCIES;
  protected readonly nicknameMax = NICKNAME_MAX;
  protected readonly maxAmount = MAX_TRANSACTION_AMOUNT;
  protected readonly typeLabel = accountTypeLabel;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['CHECKING' as AccountType, Validators.required],
    currency: ['CAD' as Currency, Validators.required],
    nickname: ['', [Validators.maxLength(NICKNAME_MAX)]],
    initialDeposit: new FormControl<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_TRANSACTION_AMOUNT),
      maxDecimals(2),
    ]),
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

  protected fieldError(name: Field, label: string): string | null {
    return controlMessage(this.form.controls[name], label, this.submitted(), this.serverFieldErrors()[name]);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    const { type, currency, nickname, initialDeposit } = this.form.getRawValue();
    const request: CreateAccountRequest = { type, currency };
    if (nickname.trim()) {
      request.nickname = nickname.trim();
    }
    if (initialDeposit !== null && initialDeposit > 0) {
      request.initialDeposit = roundCents(initialDeposit);
    }

    this.submitting.set(true);
    this.accounts.create(request).subscribe({
      next: (account) => {
        this.submitting.set(false);
        this.created.emit(account);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverFieldErrors.set(fieldErrorsOf(error));
        this.serverError.set(errorMessage(error, 'Could not open the account.'));
      },
    });
  }
}
