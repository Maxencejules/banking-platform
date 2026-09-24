import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextModalId = 0;

/**
 * Accessible modal dialog. Render it conditionally (`@if (open) { <app-modal …> }`).
 * - Moves focus inside on open and restores it to the trigger on close.
 * - Traps Tab / Shift+Tab within the dialog.
 * - Escape or a backdrop click emits `closed` (unless `busy`).
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <div
      class="modal-backdrop"
      (mousedown)="backdropPointerDown = $event.target === $event.currentTarget"
      (click)="onBackdropClick($event)"
    >
      <div
        #panel
        class="modal"
        [class.modal-sm]="size() === 'sm'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="describedBy()"
        tabindex="-1"
        (keydown)="onKeydown($event)"
      >
        <header class="modal-header">
          <h2 class="modal-title" [id]="titleId">{{ heading() }}</h2>
          <button
            type="button"
            class="icon-btn"
            aria-label="Close dialog"
            [disabled]="busy()"
            (click)="requestClose()"
          >
            <app-icon name="x" />
          </button>
        </header>
        <div class="modal-body">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent implements OnDestroy {
  readonly heading = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');
  /** While true the dialog cannot be dismissed (a request is in flight). */
  readonly busy = input(false);
  readonly describedBy = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${++nextModalId}`;
  protected backdropPointerDown = false;

  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly returnFocusTo = this.document.activeElement as HTMLElement | null;

  constructor() {
    this.document.body.classList.add('modal-open');
    afterNextRender(() => this.focusInitial());
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('modal-open');
    const target = this.returnFocusTo;
    if (target && target.isConnected && typeof target.focus === 'function') {
      // Wait for the dialog to leave the DOM before restoring focus.
      setTimeout(() => target.focus(), 0);
    }
  }

  requestClose(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.backdropPointerDown) {
      this.requestClose();
    }
    this.backdropPointerDown = false;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = this.focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === this.panel().nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
    );
  }

  private focusInitial(): void {
    const panel = this.panel().nativeElement;
    const preferred =
      panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
      panel.querySelector<HTMLElement>(
        '.modal-body input:not([disabled]):not([type="hidden"]), .modal-body select:not([disabled]), .modal-body textarea:not([disabled])',
      ) ??
      panel.querySelector<HTMLElement>('.modal-body button:not([disabled])');
    (preferred ?? panel).focus();
  }
}
