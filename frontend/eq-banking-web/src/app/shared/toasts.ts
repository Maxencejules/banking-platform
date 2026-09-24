import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastType } from '../core/ui/toast.service';
import { IconComponent, IconName } from './icon';

const TOAST_ICONS: Record<ToastType, IconName> = {
  success: 'check-circle',
  error: 'alert',
  info: 'info',
};

/** Renders the stacked toasts from {@link ToastService} in a polite live region. */
@Component({
  selector: 'app-toasts',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-region" role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.type">
          <app-icon [name]="icons[toast.type]" />
          <p class="toast-message">
            <span class="sr-only">{{ toast.type === 'error' ? 'Error: ' : '' }}</span>{{ toast.message }}
          </p>
          <button
            type="button"
            class="icon-btn"
            aria-label="Dismiss notification"
            (click)="toastService.dismiss(toast.id)"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly icons = TOAST_ICONS;
}
