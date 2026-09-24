import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/ui/theme.service';
import { ToastsComponent } from './shared/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toasts />
  `,
})
export class App {
  constructor() {
    // Instantiate early so the saved / preferred theme applies on every page, including sign-in.
    inject(ThemeService);
  }
}
