import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('stacks multiple toasts in order', () => {
    toasts.success('Saved');
    toasts.error('Failed');
    toasts.info('FYI');
    expect(toasts.toasts().map((t) => [t.type, t.message])).toEqual([
      ['success', 'Saved'],
      ['error', 'Failed'],
      ['info', 'FYI'],
    ]);
  });

  it('dismisses a single toast by id', () => {
    const first = toasts.info('one');
    toasts.info('two');
    toasts.dismiss(first);
    expect(toasts.toasts().map((t) => t.message)).toEqual(['two']);
  });

  it('auto-dismisses each toast after its own duration', () => {
    toasts.show('short', 'info', 1000);
    toasts.show('long', 'info', 5000);
    vi.advanceTimersByTime(1500);
    expect(toasts.toasts().map((t) => t.message)).toEqual(['long']);
    vi.advanceTimersByTime(4000);
    expect(toasts.toasts()).toEqual([]);
  });

  it('keeps sticky toasts (duration 0) until dismissed', () => {
    toasts.show('sticky', 'error', 0);
    vi.advanceTimersByTime(60_000);
    expect(toasts.toasts().length).toBe(1);
    toasts.clear();
    expect(toasts.toasts().length).toBe(0);
  });

  it('caps the stack by dropping the oldest', () => {
    for (let i = 1; i <= 6; i++) {
      toasts.info(`toast ${i}`);
    }
    expect(toasts.toasts().map((t) => t.message)).toEqual(['toast 3', 'toast 4', 'toast 5', 'toast 6']);
  });
});
