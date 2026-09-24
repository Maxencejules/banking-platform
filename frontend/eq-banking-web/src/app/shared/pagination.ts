import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from './icon';

/** Previous/next pager for 0-based `PageResponse` pages. */
@Component({
  selector: 'app-pagination',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pagination" [attr.aria-label]="label()">
      <p aria-live="polite">
        @if (totalElements() > 0) {
          Showing <strong>{{ rangeStart() }}–{{ rangeEnd() }}</strong> of <strong>{{ totalElements() }}</strong>
        } @else {
          No results
        }
      </p>
      <div class="pagination-controls">
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="disabled() || page() <= 0"
          (click)="pageChange.emit(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="16" />
          <span>Previous</span>
        </button>
        <span class="nowrap">Page {{ page() + 1 }} of {{ pageCount() }}</span>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="disabled() || page() + 1 >= pageCount()"
          (click)="pageChange.emit(page() + 1)"
        >
          <span>Next</span>
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </div>
    </nav>
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly totalElements = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly disabled = input(false);
  readonly label = input('Pagination');
  readonly pageChange = output<number>();

  protected readonly pageCount = computed(() => Math.max(1, this.totalPages()));
  protected readonly rangeStart = computed(() => this.page() * this.size() + 1);
  protected readonly rangeEnd = computed(() =>
    Math.min(this.totalElements(), (this.page() + 1) * this.size()),
  );
}
