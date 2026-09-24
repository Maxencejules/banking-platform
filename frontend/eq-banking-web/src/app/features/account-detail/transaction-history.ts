import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AccountService } from '../../core/api/account.service';
import {
  Currency,
  PageResponse,
  TRANSACTION_TYPES,
  TransactionResponse,
  TransactionType,
} from '../../core/api/models';
import { errorMessage } from '../../core/util/errors';
import { isCredit, transactionTypeLabel } from '../../core/util/format';
import { IconComponent } from '../../shared/icon';
import { PaginationComponent } from '../../shared/pagination';
import { MaskAccountPipe, TransactionTypePipe } from '../../shared/pipes';

interface Filters {
  type: TransactionType | '';
  from: string;
  to: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; result: PageResponse<TransactionResponse> };

const EMPTY_FILTERS: Filters = { type: '', from: '', to: '' };

/** Paged, filterable transaction history for one account. */
@Component({
  selector: 'app-transaction-history',
  imports: [FormsModule, CurrencyPipe, DatePipe, IconComponent, PaginationComponent, MaskAccountPipe, TransactionTypePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transaction-history.html',
})
export class TransactionHistoryComponent {
  private readonly accounts = inject(AccountService);

  readonly accountId = input.required<number>();
  readonly currency = input.required<Currency>();
  /** Bump to force a reload (e.g. after a deposit). */
  readonly version = input(0);

  protected readonly types = TRANSACTION_TYPES;
  protected readonly typeLabel = transactionTypeLabel;
  protected readonly isCredit = isCredit;
  protected readonly pageSizes = [10, 20, 50];

  /** Filter inputs being edited; applied on submit. */
  protected readonly draft = signal<Filters>({ ...EMPTY_FILTERS });
  protected readonly applied = signal<Filters>({ ...EMPTY_FILTERS });
  protected readonly filterError = signal<string | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly size = signal(10);

  protected readonly hasFilters = computed(() => {
    const f = this.applied();
    return !!(f.type || f.from || f.to);
  });

  private readonly query = computed(() => ({
    id: this.accountId(),
    page: this.pageIndex(),
    size: this.size(),
    filters: this.applied(),
    version: this.version(),
  }));

  /** Last successfully loaded page; kept visible (dimmed) while the next one loads. */
  protected readonly result = signal<PageResponse<TransactionResponse> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    toObservable(this.query)
      .pipe(
        switchMap((q) =>
          this.accounts
            .transactions(q.id, {
              page: q.page,
              size: q.size,
              type: q.filters.type || null,
              from: q.filters.from || null,
              to: q.filters.to || null,
            })
            .pipe(
              map((result): LoadState => ({ status: 'loaded', result })),
              catchError((error: unknown) =>
                of<LoadState>({ status: 'error', message: errorMessage(error, 'Could not load transactions.') }),
              ),
              startWith<LoadState>({ status: 'loading' }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.loading.set(state.status === 'loading');
        if (state.status === 'error') {
          this.loadError.set(state.message);
        } else if (state.status === 'loaded') {
          this.loadError.set(null);
          this.result.set(state.result);
        }
      });
  }

  protected updateDraft(patch: Partial<Filters>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
    this.filterError.set(null);
  }

  protected applyFilters(): void {
    const draft = this.draft();
    if (draft.from && draft.to && draft.from > draft.to) {
      this.filterError.set('The start date must be on or before the end date.');
      return;
    }
    this.filterError.set(null);
    this.applied.set({ ...draft });
    this.pageIndex.set(0);
  }

  protected resetFilters(): void {
    this.draft.set({ ...EMPTY_FILTERS });
    this.applied.set({ ...EMPTY_FILTERS });
    this.filterError.set(null);
    this.pageIndex.set(0);
  }

  protected changeSize(size: number): void {
    this.size.set(size);
    this.pageIndex.set(0);
  }

  protected retry(): void {
    this.applied.set({ ...this.applied() });
  }
}
