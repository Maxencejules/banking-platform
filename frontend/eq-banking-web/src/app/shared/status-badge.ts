import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AccountStatus } from '../core/api/models';
import { statusLabel } from '../core/util/format';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="cssClass()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<AccountStatus>();
  protected readonly label = computed(() => statusLabel(this.status()));
  protected readonly cssClass = computed(() => `badge badge-${this.status().toLowerCase()}`);
}
