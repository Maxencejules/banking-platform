import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/api/account.service';
import { ToastService } from '../../core/ui/toast.service';
import { saveBlob } from '../../core/util/browser';
import { errorMessageAsync } from '../../core/util/errors';
import { firstDayOfMonth, today } from '../../core/util/format';
import { IconComponent } from '../../shared/icon';

/** CSV statement download for an inclusive date range. */
@Component({
  selector: 'app-statement-card',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="statement-heading">
      <div class="card-header">
        <h2 id="statement-heading">Statement</h2>
        <app-icon name="file" />
      </div>
      <form class="card-body form-grid" (ngSubmit)="download()" novalidate>
        <p class="muted small">Download all transactions in a date range as a CSV file.</p>
        <div class="form-grid-2">
          <div class="field">
            <label class="field-label" for="statement-from">From</label>
            <input
              id="statement-from"
              class="control"
              type="date"
              name="from"
              required
              [max]="to() || todayIso"
              [ngModel]="from()"
              (ngModelChange)="from.set($event); error.set(null)"
              [attr.aria-invalid]="!!error()"
              [attr.aria-describedby]="error() ? 'statement-error' : null"
            />
          </div>
          <div class="field">
            <label class="field-label" for="statement-to">To</label>
            <input
              id="statement-to"
              class="control"
              type="date"
              name="to"
              required
              [min]="from()"
              [ngModel]="to()"
              (ngModelChange)="to.set($event); error.set(null)"
              [attr.aria-invalid]="!!error()"
              [attr.aria-describedby]="error() ? 'statement-error' : null"
            />
          </div>
        </div>
        @if (error(); as message) {
          <p class="field-error" id="statement-error" role="alert">{{ message }}</p>
        }
        <button type="submit" class="btn btn-outline" [disabled]="downloading()">
          @if (downloading()) {
            <span class="btn-spinner" aria-hidden="true"></span>
            Preparing…
          } @else {
            <app-icon name="download" />
            Download statement (CSV)
          }
        </button>
      </form>
    </section>
  `,
})
export class StatementCardComponent {
  private readonly accounts = inject(AccountService);
  private readonly toast = inject(ToastService);

  readonly accountId = input.required<number>();
  readonly accountNumber = input.required<string>();

  protected readonly todayIso = today();
  protected readonly from = signal(firstDayOfMonth());
  protected readonly to = signal(today());
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected download(): void {
    const from = this.from();
    const to = this.to();
    if (!from || !to) {
      this.error.set('Choose both a start and an end date.');
      return;
    }
    if (from > to) {
      this.error.set('The start date must be on or before the end date.');
      return;
    }

    this.error.set(null);
    this.downloading.set(true);
    this.accounts.statement(this.accountId(), from, to).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        saveBlob(blob, `mj-statement-${this.accountNumber()}-${from}_to_${to}.csv`);
        this.toast.success('Statement downloaded.');
      },
      error: async (error: unknown) => {
        this.downloading.set(false);
        this.error.set(await errorMessageAsync(error, 'Could not download the statement.'));
      },
    });
  }
}
