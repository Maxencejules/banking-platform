import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const MAX_VISIBLE = 4;

/** Stacked, auto-dismissing notifications rendered by `<app-toasts>`. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly items = signal<readonly Toast[]>([]);

  /** Currently visible toasts, oldest first. */
  readonly toasts = this.items.asReadonly();

  show(message: string, type: ToastType = 'info', durationMs = 4000): number {
    const toast: Toast = { id: this.nextId++, message, type };
    const next = [...this.items(), toast];
    // Drop the oldest when too many pile up.
    for (const dropped of next.splice(0, Math.max(0, next.length - MAX_VISIBLE))) {
      this.clearTimer(dropped.id);
    }
    this.items.set(next);

    if (durationMs > 0) {
      this.timers.set(
        toast.id,
        setTimeout(() => this.dismiss(toast.id), durationMs),
      );
    }
    return toast.id;
  }

  success(message: string, durationMs = 4000): number {
    return this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 6000): number {
    return this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 4000): number {
    return this.show(message, 'info', durationMs);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  clear(): void {
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }
    this.items.set([]);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
