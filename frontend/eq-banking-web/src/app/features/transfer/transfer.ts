import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../core/api/account.service';
import {
  AccountResponse,
  RecipientResponse,
  TransferRequest,
  TransferResponse,
} from '../../core/api/models';
import { TransferService } from '../../core/api/transfer.service';
import { ToastService } from '../../core/ui/toast.service';
import { uuid } from '../../core/util/browser';
import { errorMessage, fieldErrorsOf } from '../../core/util/errors';
import { accountDisplayName, maskAccountNumber, roundCents } from '../../core/util/format';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import {
  DESCRIPTION_MAX,
  accountNumberValidator,
  amountValidators,
  normalizeAccountNumber,
} from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { AccountNamePipe, GroupAccountPipe, MaskAccountPipe } from '../../shared/pipes';

export type TransferStep = 'details' | 'review' | 'done';

export interface TransferReview {
  from: AccountResponse;
  recipient: RecipientResponse;
  amount: number;
  description: string;
  balanceAfter: number;
}
type Field = 'fromAccountId' | 'toAccountNumber' | 'amount' | 'description';

@Component({
  selector: 'app-transfer',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, IconComponent, AccountNamePipe, MaskAccountPipe, GroupAccountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer.html',
  styleUrl: './transfer.scss',
})
export class TransferComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly transfers = inject(TransferService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Optional `?from=<accountId>` query parameter to preselect the source account. */
  readonly from = input<string | undefined>(undefined);

  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly accounts = signal<AccountResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly step = signal<TransferStep>('details');
  protected readonly submitted = signal(false);
  protected readonly serverFieldErrors = signal<Record<string, string>>({});

  protected readonly recipient = signal<RecipientResponse | null>(null);
  protected readonly recipientLoading = signal(false);
  protected readonly recipientError = signal<string | null>(null);

  protected readonly sending = signal(false);
  protected readonly transferError = signal<string | null>(null);
  protected readonly receipt = signal<TransferResponse | null>(null);
  /** Idempotency key of the transfer attempt under review; reused on retry. */
  protected readonly idempotencyKey = signal<string | null>(null);

  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      fromAccountId: new FormControl<number | null>(null, Validators.required),
      toAccountNumber: ['', [Validators.required, accountNumberValidator]],
      amount: new FormControl<number | null>(null, amountValidators),
      description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
    },
    { validators: (group) => this.crossFieldRules(group) },
  );

  private readonly fromAccountId = toSignal(this.form.controls.fromAccountId.valueChanges, {
    initialValue: null,
  });
  private readonly toAccountNumber = toSignal(this.form.controls.toAccountNumber.valueChanges, {
    initialValue: '',
  });

  /** Only ACTIVE accounts can send money. */
  protected readonly sourceAccounts = computed(() => this.accounts().filter((a) => a.status === 'ACTIVE'));
  protected readonly fromAccount = computed(
    () => this.sourceAccounts().find((a) => a.id === this.fromAccountId()) ?? null,
  );
  /** The caller's other ACTIVE accounts in the same currency (quick pick). */
  protected readonly ownDestinations = computed(() => {
    const from = this.fromAccount();
    return this.sourceAccounts().filter((a) => a.id !== from?.id && (!from || a.currency === from.currency));
  });
  protected readonly selectedOwnDestination = computed(() => {
    const number = normalizeAccountNumber(this.toAccountNumber());
    return this.ownDestinations().find((a) => a.accountNumber === number)?.accountNumber ?? '';
  });
  protected readonly currencyMismatch = computed(() => {
    const recipient = this.recipient();
    const from = this.fromAccount();
    return !!recipient && !!from && recipient.currency !== from.currency;
  });
  /** Frozen snapshot of what the user is confirming (matches the idempotency key). */
  protected readonly review = signal<TransferReview | null>(null);

  constructor() {
    // A different destination must be verified again.
    this.form.controls.toAccountNumber.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const current = this.recipient();
      if (current && current.accountNumber !== normalizeAccountNumber(value)) {
        this.recipient.set(null);
      }
      this.recipientError.set(null);
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  protected loadAccounts(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.accountService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts) => {
          this.accounts.set(accounts);
          this.loading.set(false);
          this.preselectSource();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(errorMessage(error, 'We could not load your accounts.'));
        },
      });
  }

  protected fieldError(name: Field, label: string): string | null {
    return controlMessage(this.form.controls[name], label, this.submitted(), this.serverFieldErrors()[name]);
  }

  protected chooseOwnDestination(accountNumber: string): void {
    if (!accountNumber) {
      return;
    }
    this.form.controls.toAccountNumber.setValue(accountNumber);
    this.form.controls.toAccountNumber.markAsTouched();
    this.lookupRecipient();
  }

  /** Verifies the destination via GET /transfers/recipient, then runs `then` on success. */
  protected lookupRecipient(then?: () => void): void {
    const control = this.form.controls.toAccountNumber;
    control.markAsTouched();
    const accountNumber = normalizeAccountNumber(control.value);
    if (control.value !== accountNumber) {
      control.setValue(accountNumber);
    }
    if (control.invalid) {
      return;
    }
    const known = this.recipient();
    if (known && known.accountNumber === accountNumber) {
      then?.();
      return;
    }

    this.recipientLoading.set(true);
    this.recipientError.set(null);
    this.transfers
      .lookupRecipient(accountNumber)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (recipient) => {
          this.recipientLoading.set(false);
          // Ignore stale responses if the field changed meanwhile.
          if (normalizeAccountNumber(control.value) !== recipient.accountNumber) {
            return;
          }
          this.recipient.set(recipient);
          then?.();
        },
        error: (error: unknown) => {
          this.recipientLoading.set(false);
          this.recipientError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'No account was found with that number.'
              : errorMessage(error, 'We could not verify this account.'),
          );
        },
      });
  }

  protected continueToReview(): void {
    this.submitted.set(true);
    this.transferError.set(null);
    this.form.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    this.lookupRecipient(() => {
      const from = this.fromAccount();
      const recipient = this.recipient();
      const { amount, description } = this.form.getRawValue();
      if (!from || !recipient || amount === null || this.currencyMismatch()) {
        return;
      }
      this.review.set({
        from,
        recipient,
        amount: roundCents(amount),
        description: description.trim(),
        balanceAfter: roundCents(from.balance - amount),
      });
      // A new attempt: fresh idempotency key, reused if the confirmation is retried.
      this.idempotencyKey.set(uuid());
      this.goTo('review');
    });
  }

  protected backToDetails(): void {
    if (this.sending()) {
      return;
    }
    this.idempotencyKey.set(null);
    this.review.set(null);
    this.transferError.set(null);
    this.goTo('details');
  }

  protected confirm(): void {
    const review = this.review();
    let key = this.idempotencyKey();
    if (!review || this.sending()) {
      return;
    }
    if (!key) {
      key = uuid();
      this.idempotencyKey.set(key);
    }

    const request: TransferRequest = {
      fromAccountId: review.from.id,
      toAccountNumber: review.recipient.accountNumber,
      amount: review.amount,
    };
    if (review.description) {
      request.description = review.description;
    }

    this.sending.set(true);
    this.transferError.set(null);
    this.transfers.transfer(request, key).subscribe({
      next: (response) => {
        this.sending.set(false);
        this.receipt.set(response);
        this.idempotencyKey.set(null);
        this.accounts.update((list) => list.map((a) => (a.id === response.fromAccount.id ? response.fromAccount : a)));
        this.toast.success('Transfer sent.');
        this.goTo('done');
      },
      error: (error: unknown) => {
        this.sending.set(false);
        const fieldErrors = fieldErrorsOf(error);
        if (Object.keys(fieldErrors).length) {
          this.serverFieldErrors.set(fieldErrors);
        }
        this.transferError.set(errorMessage(error, 'The transfer could not be completed.'));
      },
    });
  }

  protected startOver(): void {
    const fromId = this.fromAccount()?.id ?? null;
    this.form.reset({ fromAccountId: fromId, toAccountNumber: '', amount: null, description: '' });
    this.recipient.set(null);
    this.receipt.set(null);
    this.review.set(null);
    this.submitted.set(false);
    this.transferError.set(null);
    this.idempotencyKey.set(null);
    this.goTo('details');
  }

  protected accountLabel(account: AccountResponse): string {
    return `${accountDisplayName(account)} (${maskAccountNumber(account.accountNumber)})`;
  }

  private preselectSource(): void {
    const requested = Number(this.from());
    const sources = this.sourceAccounts();
    const match = sources.find((a) => a.id === requested) ?? (sources.length === 1 ? sources[0] : undefined);
    if (match && this.form.controls.fromAccountId.value === null) {
      this.form.controls.fromAccountId.setValue(match.id);
    }
  }

  private goTo(step: TransferStep): void {
    this.step.set(step);
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Same-account and available-balance checks, attached to the relevant controls. */
  private crossFieldRules(group: AbstractControl): ValidationErrors | null {
    const fromId = group.get('fromAccountId')?.value as number | null;
    const toControl = group.get('toAccountNumber');
    const amountControl = group.get('amount');
    // `accounts` is a field initializer declared before the form, so it exists here.
    const from = this.accounts().find((a) => a.id === fromId);
    if (!from || !toControl || !amountControl) {
      return null;
    }
    setError(toControl, 'sameAccount', normalizeAccountNumber(toControl.value as string) === from.accountNumber);
    const amount = amountControl.value as number | null;
    setError(amountControl, 'insufficientFunds', amount !== null && amount > from.balance);
    return null;
  }
}

function setError(control: AbstractControl, key: string, active: boolean): void {
  const errors: ValidationErrors = { ...(control.errors ?? {}) };
  if (active === !!errors[key]) {
    return;
  }
  if (active) {
    errors[key] = true;
  } else {
    delete errors[key];
  }
  control.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
}
