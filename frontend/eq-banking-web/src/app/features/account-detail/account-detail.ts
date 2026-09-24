import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { AccountService } from '../../core/api/account.service';
import { AccountResponse } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { copyToClipboard } from '../../core/util/browser';
import { errorMessage } from '../../core/util/errors';
import { accountDisplayName, roundCents } from '../../core/util/format';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog';
import { IconComponent } from '../../shared/icon';
import { AccountTypePipe, GroupAccountPipe } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge';
import { MoneyDialogComponent, MoneyMode } from './money-dialog';
import { RenameDialogComponent } from './rename-dialog';
import { StatementCardComponent } from './statement-card';
import { TransactionHistoryComponent } from './transaction-history';

type Dialog = MoneyMode | 'rename' | 'freeze' | 'close';

type LoadResult =
  | { status: 'loading' }
  | { status: 'loaded'; account: AccountResponse }
  | { status: 'error'; message: string; notFound: boolean };

@Component({
  selector: 'app-account-detail',
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    IconComponent,
    StatusBadgeComponent,
    AccountTypePipe,
    GroupAccountPipe,
    ConfirmDialogComponent,
    MoneyDialogComponent,
    RenameDialogComponent,
    StatementCardComponent,
    TransactionHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-detail.html',
  styleUrl: './account-detail.scss',
})
export class AccountDetailComponent {
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);
  protected readonly auth = inject(AuthService);

  /** Route parameter `:id` (bound via withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly accountId = computed(() => Number(this.id()));
  protected readonly account = signal<AccountResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly notFound = signal(false);

  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly actionBusy = signal(false);
  protected readonly historyVersion = signal(0);

  protected readonly name = computed(() => {
    const account = this.account();
    return account ? accountDisplayName(account) : 'Account';
  });
  protected readonly isActive = computed(() => this.account()?.status === 'ACTIVE');
  protected readonly isClosed = computed(() => this.account()?.status === 'CLOSED');
  protected readonly isOwner = computed(() => this.account()?.ownerId === this.auth.user()?.id);
  protected readonly backLink = computed(() =>
    this.auth.isAdmin() && !this.isOwner() ? '/admin' : '/dashboard',
  );

  protected readonly limit = computed(() => {
    const account = this.account();
    if (!account) {
      return { used: 0, remaining: 0, percent: 0 };
    }
    const max = account.dailyWithdrawalLimit;
    const used = account.withdrawnToday;
    const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
    return { used, remaining: Math.max(0, roundCents(max - used)), percent };
  });

  private readonly reload$ = new BehaviorSubject<void>(undefined);

  constructor() {
    combineLatest([toObservable(this.accountId), this.reload$])
      .pipe(
        switchMap(([id]) => this.fetch(id)),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(result.status === 'loading');
        if (result.status === 'loaded') {
          this.account.set(result.account);
          this.loadError.set(null);
        } else if (result.status === 'error') {
          this.account.set(null);
          this.loadError.set(result.message);
          this.notFound.set(result.notFound);
        }
      });
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected openDialog(dialog: Dialog): void {
    this.dialog.set(dialog);
  }

  protected closeDialog(): void {
    if (!this.actionBusy()) {
      this.dialog.set(null);
    }
  }

  protected onMoneyCompleted(mode: MoneyMode, updated: AccountResponse, previous: AccountResponse): void {
    const delta = Math.abs(roundCents(updated.balance - previous.balance));
    this.account.set(updated);
    this.dialog.set(null);
    this.historyVersion.update((v) => v + 1);
    const amount = new Intl.NumberFormat(this.locale, { style: 'currency', currency: updated.currency }).format(delta);
    this.toast.success(mode === 'deposit' ? `Deposited ${amount}.` : `Withdrew ${amount}.`);
  }

  protected onRenamed(updated: AccountResponse): void {
    this.account.set(updated);
    this.dialog.set(null);
    this.toast.success(`Account renamed to “${accountDisplayName(updated)}”.`);
  }

  protected freeze(): void {
    this.runAction(
      (id) => this.accountService.freeze(id),
      'Account frozen. Deposits, withdrawals and transfers are blocked.',
    );
  }

  protected unfreeze(): void {
    this.runAction((id) => this.accountService.unfreeze(id), 'Account unfrozen and active again.');
  }

  protected closeAccount(): void {
    this.runAction((id) => this.accountService.close(id), 'Account closed.');
  }

  protected async copyNumber(accountNumber: string): Promise<void> {
    const copied = await copyToClipboard(accountNumber);
    if (copied) {
      this.toast.success('Account number copied.');
    } else {
      this.toast.error('Copy is not available in this browser.');
    }
  }

  private runAction(call: (id: number) => Observable<AccountResponse>, successMessage: string): void {
    const account = this.account();
    if (!account || this.actionBusy()) {
      return;
    }
    this.actionBusy.set(true);
    call(account.id).subscribe({
      next: (updated) => {
        this.actionBusy.set(false);
        this.account.set(updated);
        this.dialog.set(null);
        this.toast.success(successMessage);
      },
      error: (error: unknown) => {
        this.actionBusy.set(false);
        this.dialog.set(null);
        this.toast.error(errorMessage(error, 'The action could not be completed.'));
      },
    });
  }

  private fetch(id: number): Observable<LoadResult> {
    if (!Number.isInteger(id) || id <= 0) {
      return of({ status: 'error', message: 'This account does not exist.', notFound: true });
    }
    return this.accountService.get(id).pipe(
      map((account): LoadResult => ({ status: 'loaded', account })),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const notFound = status === 404 || status === 403;
        return of<LoadResult>({
          status: 'error',
          notFound,
          message: notFound
            ? 'This account does not exist or you do not have access to it.'
            : errorMessage(error, 'We could not load this account.'),
        });
      }),
      startWith<LoadResult>({ status: 'loading' }),
    );
  }
}
