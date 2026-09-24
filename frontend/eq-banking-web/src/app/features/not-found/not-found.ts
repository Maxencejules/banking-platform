import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="not-found" id="main-content">
      <div class="card not-found-card">
        <span class="code" aria-hidden="true">404</span>
        <app-icon name="compass" [size]="40" />
        <h1>Page not found</h1>
        <p class="muted">The page you're looking for doesn't exist or has moved.</p>
        <a class="btn btn-primary" [routerLink]="auth.isAuthenticated() ? auth.homeUrl() : '/login'">
          <app-icon name="arrow-left" [size]="16" />
          {{ auth.isAuthenticated() ? 'Back to MJ Banking' : 'Go to sign in' }}
        </a>
      </div>
    </main>
  `,
  styles: `
    .not-found { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem var(--page-gutter); }
    .not-found-card {
      position: relative; overflow: hidden; max-width: 28rem; width: 100%;
      padding: 3rem 2rem; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
      color: var(--color-primary);
    }
    .not-found-card h1 { color: var(--color-text-main); font-size: 1.5rem; }
    .code {
      position: absolute; top: -1.5rem; left: 50%; transform: translateX(-50%);
      font-size: 8rem; font-weight: 900; opacity: 0.06; color: var(--color-text-main); pointer-events: none;
    }
  `,
})
export class NotFoundComponent {
  protected readonly auth = inject(AuthService);
}
