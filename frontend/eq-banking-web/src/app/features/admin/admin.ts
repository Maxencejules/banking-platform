import { CurrencyPipe, DOCUMENT, DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { AccountService } from '../../core/api/account.service';
import { AdminService } from '../../core/api/admin.service';
import {
  ACCOUNT_STATUSES,
  AccountResponse,
  AccountStatus,
  AdminStats,
  InterestRunResponse,
  PageResponse,
  UserResponse,
} from '../../core/api/models';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/util/errors';
import { accountDisplayName, statusLabel } from '../../core/util/format';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog';
import { IconComponent } from '../../shared/icon';
import { PaginationComponent } from '../../shared/pagination';
import { AccountNamePipe, AccountTypePipe, GroupAccountPipe } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge';

type Tab = 'accounts' | 'users';
type AccountAction = 'freeze' | 'unfreeze' | 'close';

interface Paged<T> {
  loading: boolean;
  error: string | null;
  data: PageResponse<T> | null;
}

const PAGE_SIZE = 10;

/** Emits a loading marker, then the page (or an error), for use with switchMap. */
function paged<T>(source: Observable<PageResponse<T>>, fallback: string): Observable<Partial<Paged<T>>> {
  return source.pipe(
    map((data): Partial<Paged<T>> => ({ loading: false, error: null, data })),
    catchError((error: unknown) => of<Partial<Paged<T>>>({ loading: false, error: errorMessage(error, fallback) })),
    startWith<Partial<Paged<T>>>({ loading: true }),
  );
}

@Component({
  selector: 'app-admin',
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    KeyValuePipe,
    IconComponent,
    PaginationComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    AccountNamePipe,
    AccountTypePipe,
    GroupAccountPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  protected readonly statuses = ACCOUNT_STATUSES;
  protected readonly statusLabel = statusLabel;
  protected readonly tab = signal<Tab>('accounts');

  /* ------------------------------------------------------------ Stats */
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly statsError = signal<string | null>(null);

  /* --------------------------------------------------------- Accounts */
  protected readonly accountSearch = signal('');
  protected readonly accountQuery = signal({ q: '', status: '' as AccountStatus | '', page: 0 });
  protected readonly accounts = signal<Paged<AccountResponse>>({ loading: true, error: null, data: null });
  private readonly accountsReload = signal(0);
  protected readonly rowBusy = signal<number | null>(null);
  protected readonly pendingClose = signal<AccountResponse | null>(null);

  /* ------------------------------------------------------------ Users */
  protected readonly userSearch = signal('');
  protected readonly userQuery = signal({ q: '', page: 0 });
  protected readonly users = signal<Paged<UserResponse>>({ loading: true, error: null, data: null });

  /* --------------------------------------------------------- Interest */
  protected readonly confirmInterest = signal(false);
  protected readonly interestRunning = signal(false);
  protected readonly interestResult = signal<InterestRunResponse | null>(null);

  protected readonly hasAccountFilters = computed(() => {
    const q = this.accountQuery();
    return !!(q.q || q.status);
  });

  constructor() {
    toObservable(computed(() => ({ ...this.accountQuery(), reload: this.accountsReload() })))
      .pipe(
        switchMap((query) =>
          paged(
            this.admin.accounts({ q: query.q, status: query.status || null, page: query.page, size: PAGE_SIZE }),
            'Could not load accounts.',
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((patch) => this.accounts.update((current) => ({ ...current, ...patch })));

    toObservable(this.userQuery)
      .pipe(
        switchMap((query) =>
          paged(this.admin.users({ q: query.q, page: query.page, size: PAGE_SIZE }), 'Could not load users.'),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((patch) => this.users.update((current) => ({ ...current, ...patch })));
  }

  ngOnInit(): void {
    this.loadStats();
  }

  protected loadStats(): void {
    this.statsError.set(null);
    this.admin.stats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (error: unknown) => this.statsError.set(errorMessage(error, 'Could not load statistics.')),
    });
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next: Tab = this.tab() === 'accounts' ? 'users' : 'accounts';
      this.tab.set(next);
      this.document.getElementById(`tab-${next}`)?.focus();
    }
  }

  /* --------------------------------------------------------- Accounts */

  protected searchAccounts(): void {
    this.accountQuery.update((q) => ({ ...q, q: this.accountSearch().trim(), page: 0 }));
  }

  protected filterStatus(status: AccountStatus | ''): void {
    this.accountQuery.update((q) => ({ ...q, status, page: 0 }));
  }

  protected clearAccountFilters(): void {
    this.accountSearch.set('');
    this.accountQuery.set({ q: '', status: '', page: 0 });
  }

  protected accountsPage(page: number): void {
    this.accountQuery.update((q) => ({ ...q, page }));
  }

  protected reloadAccounts(): void {
    this.accountsReload.update((v) => v + 1);
  }

  protected accountAction(account: AccountResponse, action: AccountAction): void {
    if (this.rowBusy() !== null) {
      return;
    }
    const call =
      action === 'freeze'
        ? this.accountService.freeze(account.id)
        : action === 'unfreeze'
          ? this.accountService.unfreeze(account.id)
          : this.accountService.close(account.id);
    const verb = action === 'freeze' ? 'frozen' : action === 'unfreeze' ? 'unfrozen' : 'closed';

    this.rowBusy.set(account.id);
    call.subscribe({
      next: (updated) => {
        this.rowBusy.set(null);
        this.pendingClose.set(null);
        this.replaceAccount(updated);
        this.loadStats();
        this.toast.success(`${accountDisplayName(updated)} (${updated.ownerName}) ${verb}.`);
      },
      error: (error: unknown) => {
        this.rowBusy.set(null);
        this.pendingClose.set(null);
        this.toast.error(errorMessage(error, `The account could not be ${verb}.`));
      },
    });
  }

  private replaceAccount(updated: AccountResponse): void {
    this.accounts.update((state) =>
      state.data
        ? {
            ...state,
            data: {
              ...state.data,
              content: state.data.content.map((a) => (a.id === updated.id ? updated : a)),
            },
          }
        : state,
    );
  }

  /* ------------------------------------------------------------ Users */

  protected searchUsers(): void {
    this.userQuery.set({ q: this.userSearch().trim(), page: 0 });
  }

  protected clearUserSearch(): void {
    this.userSearch.set('');
    this.userQuery.set({ q: '', page: 0 });
  }

  protected usersPage(page: number): void {
    this.userQuery.update((q) => ({ ...q, page }));
  }

  /* --------------------------------------------------------- Interest */

  protected runInterest(): void {
    this.interestRunning.set(true);
    this.admin.runInterest().subscribe({
      next: (result) => {
        this.interestRunning.set(false);
        this.confirmInterest.set(false);
        this.interestResult.set(result);
        this.toast.success(`Interest credited to ${result.accountsCredited} account(s).`);
        this.loadStats();
        this.reloadAccounts();
      },
      error: (error: unknown) => {
        this.interestRunning.set(false);
        this.confirmInterest.set(false);
        this.toast.error(errorMessage(error, 'The interest run failed.'));
      },
    });
  }
}
