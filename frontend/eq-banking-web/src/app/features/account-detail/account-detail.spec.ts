import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEST_API, aPage, aTransaction, anAccount, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../../core/api/api-config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AccountDetailComponent } from './account-detail';

describe('AccountDetailComponent', () => {
  let fixture: ComponentFixture<AccountDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    seedSession();
    TestBed.configureTestingModule({
      imports: [AccountDetailComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountDetailComponent);
    fixture.componentRef.setInput('id', '3');
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  async function loadAccount(balance = 1520.35): Promise<void> {
    http.expectOne(`${TEST_API}/accounts/3`).flush(anAccount({ balance, withdrawnToday: 1250 }));
    await fixture.whenStable();
    const history = http.expectOne((r) => r.url === `${TEST_API}/accounts/3/transactions`);
    expect(history.request.params.get('page')).toBe('0');
    history.flush(
      aPage(
        [
          aTransaction({ id: 1, type: 'DEPOSIT', amount: 500, description: 'Paycheque' }),
          aTransaction({ id: 2, type: 'TRANSFER_OUT', amount: 200, description: 'Rent share' }),
        ],
        { size: 10, totalElements: 12, totalPages: 2 },
      ),
    );
    await fixture.whenStable();
  }

  it('renders the header, daily limit progress and signed transactions', async () => {
    await loadAccount();

    expect(el.querySelector('h1')?.textContent).toContain('Everyday');
    expect(el.textContent).toContain('1000 0000 0017');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');

    const amounts = Array.from(el.querySelectorAll('tbody td.amount:not(.hide-sm)')).map((td) => td.textContent ?? '');
    expect(amounts[0]).toMatch(/\+.*500\.00/);
    expect(amounts[1]).toMatch(/−.*200\.00/);
    expect(el.querySelector('tbody td.credit')).not.toBeNull();
    expect(el.querySelector('tbody td.debit')).not.toBeNull();
    expect(el.textContent).toContain('Showing 1–10 of 12');
  });

  it('applies the type and date filters as query params', async () => {
    await loadAccount();

    const type = el.querySelector<HTMLSelectElement>('#history-type')!;
    type.value = 'DEPOSIT';
    type.dispatchEvent(new Event('change'));
    const from = el.querySelector<HTMLInputElement>('#history-from')!;
    from.value = '2026-09-01';
    from.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    el.querySelector<HTMLFormElement>('form.toolbar')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const req = http.expectOne((r) => r.url === `${TEST_API}/accounts/3/transactions`);
    expect(req.request.params.get('type')).toBe('DEPOSIT');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.has('to')).toBe(false);
    req.flush(aPage([]));
  });

  it('explains that the balance must be zero before closing', async () => {
    await loadAccount();
    const closeButton = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Close account'),
    )!;
    closeButton.click();
    await fixture.whenStable();

    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('balance is exactly 0.00');
    const confirm = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Close account',
    )!;
    expect(confirm.disabled).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a not-found state for inaccessible accounts', async () => {
    http.expectOne(`${TEST_API}/accounts/3`).flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Account not found');
  });
});
