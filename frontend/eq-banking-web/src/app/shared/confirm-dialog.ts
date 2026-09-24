import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from './modal';

let nextConfirmId = 0;

/** Confirmation dialog built on `<app-modal>`. Extra explanation can be projected. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [heading]="heading()"
      size="sm"
      [busy]="busy()"
      [describedBy]="messageId"
      (closed)="cancelled.emit()"
    >
      <p [id]="messageId" class="muted">{{ message() }}</p>
      <ng-content />
      <div class="form-actions">
        <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="cancelled.emit()">
          {{ cancelLabel() }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-danger]="danger()"
          [class.btn-primary]="!danger()"
          [disabled]="busy() || confirmDisabled()"
          (click)="confirmed.emit()"
          data-autofocus
        >
          @if (busy()) {
            <span class="btn-spinner" aria-hidden="true"></span>
          }
          {{ confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly confirmDisabled = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly messageId = `confirm-message-${++nextConfirmId}`;
}
