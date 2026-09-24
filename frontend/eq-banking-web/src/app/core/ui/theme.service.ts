import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { readStorage, writeStorage } from '../util/storage';

export const THEME_STORAGE_KEY = 'mjb.theme';
const DARK_CLASS = 'dark-theme';

function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  } catch {
    return false;
  }
}

/**
 * Light/dark theme. Defaults to the OS preference; an explicit choice is persisted.
 * The `.dark-theme` class on <html> swaps the CSS variables defined in styles.scss.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT, { optional: true });
  private readonly darkMode = signal(this.initial());

  readonly isDark = this.darkMode.asReadonly();

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      const root = this.document?.documentElement;
      if (root) {
        root.classList.toggle(DARK_CLASS, dark);
        root.style.colorScheme = dark ? 'dark' : 'light';
      }
    });
  }

  toggle(): void {
    this.setDark(!this.darkMode());
  }

  setDark(dark: boolean): void {
    this.darkMode.set(dark);
    writeStorage(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
  }

  private initial(): boolean {
    const stored = readStorage(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored === 'dark';
    }
    return systemPrefersDark();
  }
}
