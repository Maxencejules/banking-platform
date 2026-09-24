import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AccountService } from '../../core/api/account.service';
import { AccountResponse, Currency, TransactionResponse } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/util/errors';
import { accountDisplayName, roundCents, signedAmount } from '../../core/util/format';
import { MAX_OPEN_ACCOUNTS } from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import {
  AccountNamePipe,
  AccountTypePipe,
  GroupAccountPipe,
  MaskAccountPipe,
  TransactionTypePipe,
} from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge';
import { OpenAccountDialogComponent } from './open-account-dialog';

export interface CurrencyTotal {
  currency: Currency;
  total: number;
  count: number;
}

export interface ActivityItem {
  tx: TransactionResponse;
  account: AccountResponse;
  signed: number;
}

const RECENT_ACTIVITY_LIMIT = 8;

/** Sums balances of open (non-closed) accounts per currency, CAD first. */
export function totalsByCurrency(accounts: readonly AccountResponse[]): CurrencyTotal[] {
  const totals = new Map<Currency, CurrencyTotal>();
  for (const account of accounts) {
    if (account.status === 'CLOSED') {
      continue;
    }
    const entry = totals.get(account.currency) ?? { currency: account.currency, total: 0, count: 0 };
    entry.total = roundCents(entry.total + account.balance);
    entry.count += 1;
    totals.set(account.currency, entry);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    IconComponent,
    StatusBadgeComponent,
    AccountNamePipe,
    AccountTypePipe,
    MaskAccountPipe,
    GroupAccountPipe,
    TransactionTypePipe,
    OpenAccountDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly accounts = signal<AccountResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly showClosed = signal(false);
  protected readonly revealed = signal<ReadonlySet<number>>(new Set());
  protected readonly dialogOpen = signal(false);

  protected readonly activity = signal<ActivityItem[]>([]);
  protected readonly activityLoading = signal(false);

  protected readonly maxOpenAccounts = MAX_OPEN_ACCOUNTS;
  protected readonly openAccounts = computed(() => this.accounts().filter((a) => a.status !== 'CLOSED'));
  protected readonly closedCount = computed(() => this.accounts().length - this.openAccounts().length);
  protected readonly visibleAccounts = computed(() =>
    this.showClosed() ? this.accounts() : this.openAccounts(),
  );
  protected readonly totals = computed(() => totalsByCurrency(this.accounts()));
  protected readonly canOpenMore = computed(() => this.openAccounts().length < MAX_OPEN_ACCOUNTS);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const first = this.auth.user()?.fullName.split(' ')[0];
    return first ? `${part}, ${first}` : part;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.accountService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts) => {
          this.accounts.set(accounts);
          this.loading.set(false);
          this.loadActivity(accounts);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(errorMessage(error, 'We could not load your accounts.'));
        },
      });
  }

  /** Merges the latest transactions of every open account into one feed. */
  private loadActivity(accounts: readonly AccountResponse[]): void {
    const open = accounts.filter((a) => a.status !== 'CLOSED').slice(0, MAX_OPEN_ACCOUNTS);
    if (!open.length) {
      this.activity.set([]);
      return;
    }
    this.activityLoading.set(true);
    forkJoin(
      open.map((account) =>
        this.accountService.transactions(account.id, { page: 0, size: 5 }).pipe(
          map((page) => page.content.map((tx) => ({ tx, account, signed: signedAmount(tx) }))),
          catchError(() => of([] as ActivityItem[])),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lists) => {
        const items = lists
          .flat()
          .sort((a, b) => Date.parse(b.tx.createdAt) - Date.parse(a.tx.createdAt))
          .slice(0, RECENT_ACTIVITY_LIMIT);
        this.activity.set(items);
        this.activityLoading.set(false);
      });
  }

  protected isRevealed(id: number): boolean {
    return this.revealed().has(id);
  }

  protected toggleReveal(id: number): void {
    this.revealed.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected onCreated(account: AccountResponse): void {
    this.dialogOpen.set(false);
    this.toast.success(`${accountDisplayName(account)} is open and ready to use.`);
    // Accounts are listed newest first.
    this.accounts.update((list) => [account, ...list.filter((a) => a.id !== account.id)]);
    this.loadActivity(this.accounts());
  }

}
