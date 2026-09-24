import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/ui/theme.service';
import { ToastService } from '../core/ui/toast.service';
import { initials } from '../core/util/format';
import { IconComponent } from '../shared/icon';

/** Authenticated application frame: header, navigation, user menu and page outlet. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu(true)',
  },
})
export class ShellComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly menuOpen = signal(false);
  protected readonly userInitials = computed(() => initials(this.auth.user()?.fullName));
  protected readonly firstName = computed(() => this.auth.user()?.fullName.split(' ')[0] ?? '');
  protected readonly year = new Date().getFullYear();

  private readonly menuRoot = viewChild<ElementRef<HTMLElement>>('menuRoot');
  private readonly menuTrigger = viewChild<ElementRef<HTMLButtonElement>>('menuTrigger');

  ngOnInit(): void {
    // Validate the stored session and pick up profile changes. A 401 is handled by the interceptor.
    this.auth
      .refreshUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    if (restoreFocus) {
      this.menuTrigger()?.nativeElement.focus();
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const root = this.menuRoot()?.nativeElement;
    if (this.menuOpen() && root && event.target instanceof Node && !root.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }
}
