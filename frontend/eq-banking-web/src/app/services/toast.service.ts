import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  private toastSubject = new BehaviorSubject<Toast | null>(null);
  toast$ = this.toastSubject.asObservable();

  show(message: string, type: ToastType = 'info', durationMs = 3000): void {
    this.toastSubject.next({ message, type });

    if (durationMs > 0) {
      setTimeout(() => {
        this.toastSubject.next(null);
      }, durationMs);
    }
  }

  success(message: string, durationMs = 3000): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4000): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 3000): void {
    this.show(message, 'info', durationMs);
  }

  clear(): void {
    this.toastSubject.next(null);
  }
}
