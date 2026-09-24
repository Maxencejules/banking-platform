import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEST_API, aPage, aTransaction, anAccount, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../../core/api/api-config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { DashboardComponent, totalsByCurrency } from './dashboard';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const accounts = [
    anAccount({ id: 3, accountNumber: '100000000017', nickname: 'Everyday', balance: 1520.35 }),
    anAccount({ id: 4, accountNumber: '100000000033', nickname: null, type: 'SAVINGS', balance: 479.65, interestRate: 2.5 }),
    anAccount({ id: 5, accountNumber: '100000000041', nickname: 'Travel', currency: 'USD', balance: 250 }),
    anAccount({ id: 6, accountNumber: '100000000058', nickname: 'Old', status: 'CLOSED', balance: 0 }),
  ];

  beforeEach(async () => {
    localStorage.clear();
    seedSession();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  async function loadAccounts(): Promise<void> {
    const req = http.expectOne(`${TEST_API}/accounts`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush(accounts);
    await fixture.whenStable();
  }

  function flushActivity(): void {
    // One request per open account (closed accounts are skipped).
    const requests = http.match((r) => r.url.endsWith('/transactions'));
    expect(requests.map((r) => r.request.url)).toEqual([
      `${TEST_API}/accounts/3/transactions`,
      `${TEST_API}/accounts/4/transactions`,
      `${TEST_API}/accounts/5/transactions`,
    ]);
    requests.forEach((req, i) =>
      req.flush(aPage(i === 0 ? [aTransaction({ id: 1, description: 'Rent share' })] : [])),
    );
  }

  it('greets the user and renders open accounts with masked numbers', async () => {
    await loadAccounts();
    flushActivity();
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Alex');
    const cards = el.querySelectorAll('.account-card');
    expect(cards.length).toBe(3); // closed account hidden by default
    expect(cards[0]?.textContent).toContain('Everyday');
    expect(cards[0]?.textContent).toContain('•••• 0017');
    expect(cards[0]?.textContent).not.toContain('100000000017');
    expect(cards[1]?.textContent).toContain('Savings account'); // fallback nickname
    expect(el.textContent).toContain('Rent share'); // recent activity
  });

  it('shows total balance per currency', async () => {
    await loadAccounts();
    flushActivity();
    await fixture.whenStable();

    const stats = Array.from(el.querySelectorAll('.stat-card')).map((c) => c.textContent ?? '');
    expect(stats[0]).toContain('Total CAD balance');
    expect(stats[0]).toContain('2,000.00');
    expect(stats[1]).toContain('Total USD balance');
    expect(stats[1]).toContain('250.00');
  });

  it('reveals the full account number on demand', async () => {
    await loadAccounts();
    flushActivity();
    await fixture.whenStable();

    const toggle = el.querySelector<HTMLButtonElement>('.account-card .account-number button')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await fixture.whenStable();

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.account-card')?.textContent).toContain('1000 0000 0017');
  });

  it('shows an error state with retry when loading fails', async () => {
    http.expectOne(`${TEST_API}/accounts`).flush({ detail: 'Service unavailable' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Something went wrong');

    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await loadAccounts();
    flushActivity();
  });
});

describe('totalsByCurrency', () => {
  it('ignores closed accounts and avoids floating point drift', () => {
    const totals = totalsByCurrency([
      anAccount({ currency: 'CAD', balance: 0.1 }),
      anAccount({ currency: 'CAD', balance: 0.2 }),
      anAccount({ currency: 'USD', balance: 5, status: 'FROZEN' }),
      anAccount({ currency: 'USD', balance: 99, status: 'CLOSED' }),
    ]);
    expect(totals).toEqual([
      { currency: 'CAD', total: 0.3, count: 2 },
      { currency: 'USD', total: 5, count: 1 },
    ]);
  });
});
