import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ToastService } from './core/ui/toast.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders the router outlet and a polite live region for toasts', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('.toast-region')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows stacked toasts from the ToastService', async () => {
    const fixture = TestBed.createComponent(App);
    const toasts = TestBed.inject(ToastService);
    toasts.success('Saved', 0);
    toasts.error('Failed', 0);
    await fixture.whenStable();

    const rendered = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.toast'));
    expect(rendered.length).toBe(2);
    expect(rendered[1]?.textContent).toContain('Failed');

    (rendered[0]?.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast').length).toBe(1);
  });
});
