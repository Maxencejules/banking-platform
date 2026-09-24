import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ThemeService } from '../../core/ui/theme.service';
import { IconComponent } from '../../shared/icon';

/** Split-screen frame shared by the sign-in and registration pages. */
@Component({
  selector: 'app-auth-layout',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <aside class="auth-hero" aria-hidden="true">
        <div class="hero-brand"><span class="hero-mark">MJ</span> MJ Banking</div>
        <div class="hero-copy">
          <h2>Banking that keeps up with you.</h2>
          <ul>
            <li><app-icon name="check" /> Chequing &amp; high-interest savings in CAD and USD</li>
            <li><app-icon name="check" /> Instant transfers with duplicate-payment protection</li>
            <li><app-icon name="check" /> Statements on demand, daily limits you can see</li>
          </ul>
        </div>
        <p class="hero-foot">Portfolio demo — no real money moves.</p>
      </aside>

      <main class="auth-main" id="main-content">
        <div class="auth-top">
          <span class="auth-mobile-brand"><span class="hero-mark">MJ</span> MJ Banking</span>
          <button
            type="button"
            class="icon-btn"
            [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
            (click)="theme.toggle()"
          >
            <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" />
          </button>
        </div>
        <div class="auth-card card">
          <h1>{{ heading() }}</h1>
          <p class="muted">{{ subheading() }}</p>
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: `
    .auth { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); min-height: 100vh; }
    .auth-hero {
      display: flex; flex-direction: column; justify-content: space-between; gap: 2rem;
      padding: 2.5rem; color: #fff;
      background: radial-gradient(circle at 20% 20%, #818cf8 0, transparent 45%),
        linear-gradient(145deg, #4338ca 0%, #6d28d9 60%, #1e1b4b 100%);
    }
    .hero-brand, .auth-mobile-brand { display: flex; align-items: center; gap: 0.6rem; font-weight: 700; font-size: 1.1rem; }
    .hero-mark {
      display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 0.6rem;
      background: rgb(255 255 255 / 0.15); border: 1px solid rgb(255 255 255 / 0.3); font-weight: 800; font-size: 0.9rem;
    }
    .hero-copy h2 { font-size: 2rem; line-height: 1.2; margin-bottom: 1.5rem; max-width: 22rem; }
    .hero-copy ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; opacity: 0.92; }
    .hero-copy li { display: flex; gap: 0.6rem; align-items: flex-start; }
    .hero-foot { font-size: 0.8rem; opacity: 0.7; }
    .auth-main { display: flex; flex-direction: column; align-items: center; padding: 1.25rem var(--page-gutter) 3rem; }
    .auth-top { width: 100%; max-width: 28rem; display: flex; justify-content: flex-end; align-items: center; margin-bottom: 1.5rem; }
    .auth-mobile-brand { display: none; margin-right: auto; }
    .auth-mobile-brand .hero-mark { background: var(--color-primary); color: #fff; border: 0; }
    .auth-card { width: 100%; max-width: 28rem; padding: 2rem; margin-block: auto; display: flex; flex-direction: column; gap: 0.35rem; }
    .auth-card h1 { font-size: 1.6rem; font-weight: 700; }
    @media (max-width: 860px) {
      .auth { grid-template-columns: minmax(0, 1fr); }
      .auth-hero { display: none; }
      .auth-mobile-brand { display: flex; }
    }
    @media (max-width: 420px) { .auth-card { padding: 1.5rem 1.25rem; } }
  `,
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  protected readonly theme = inject(ThemeService);
}
