import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEST_API, aPage, anAccount } from '../../../testing/fixtures';
import { AccountService, transactionQueryParams } from './account.service';
import { API_BASE_URL, toHttpParams } from './api-config';

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('transaction query params', () => {
    it('defaults to the first page of 20 and omits empty filters', () => {
      expect(transactionQueryParams().toString()).toBe('page=0&size=20');
      expect(transactionQueryParams({ type: null, from: '', to: undefined }).toString()).toBe('page=0&size=20');
    });

    it('includes every provided filter', () => {
      const params = transactionQueryParams({
        page: 2,
        size: 50,
        type: 'DEPOSIT',
        from: '2026-09-01',
        to: '2026-09-24',
      });
      expect(params.get('page')).toBe('2');
      expect(params.get('size')).toBe('50');
      expect(params.get('type')).toBe('DEPOSIT');
      expect(params.get('from')).toBe('2026-09-01');
      expect(params.get('to')).toBe('2026-09-24');
    });

    it('toHttpParams trims strings and skips blanks', () => {
      expect(toHttpParams({ q: '  alex ', status: null, empty: '   ', page: 0 }).toString()).toBe('q=alex&page=0');
    });
  });

  it('GET /accounts/{id}/transactions with the query string', () => {
    service.transactions(3, { page: 1, size: 10, type: 'TRANSFER_OUT', from: '2026-09-01' }).subscribe();

    const req = http.expectOne((r) => r.url === `${TEST_API}/accounts/3/transactions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toBe(
      `${TEST_API}/accounts/3/transactions?page=1&size=10&type=TRANSFER_OUT&from=2026-09-01`,
    );
    req.flush(aPage([]));
  });

  it('downloads statements as a blob with the date range', () => {
    let received: Blob | undefined;
    service.statement(3, '2026-09-01', '2026-09-30').subscribe((blob) => (received = blob));

    const req = http.expectOne((r) => r.url === `${TEST_API}/accounts/3/statement`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush(new Blob(['date,amount\n'], { type: 'text/csv' }));
    expect(received).toBeInstanceOf(Blob);
  });

  it('creates accounts with only the provided optional fields', () => {
    service.create({ type: 'SAVINGS', currency: 'USD', nickname: 'Trip' }).subscribe();
    const req = http.expectOne(`${TEST_API}/accounts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ type: 'SAVINGS', currency: 'USD', nickname: 'Trip' });
    req.flush(anAccount({ type: 'SAVINGS', currency: 'USD' }), { status: 201, statusText: 'Created' });
  });

  it('uses the documented endpoints for account actions', () => {
    service.rename(3, 'Bills').subscribe();
    const rename = http.expectOne(`${TEST_API}/accounts/3`);
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ nickname: 'Bills' });
    rename.flush(anAccount());

    service.deposit(3, { amount: 25.5, description: 'Gift' }).subscribe();
    const deposit = http.expectOne(`${TEST_API}/accounts/3/deposit`);
    expect(deposit.request.body).toEqual({ amount: 25.5, description: 'Gift' });
    deposit.flush(anAccount());

    for (const action of ['withdraw', 'freeze', 'unfreeze', 'close'] as const) {
      const call =
        action === 'withdraw' ? service.withdraw(3, { amount: 1 }) : service[action](3);
      call.subscribe();
      const req = http.expectOne(`${TEST_API}/accounts/3/${action}`);
      expect(req.request.method).toBe('POST');
      req.flush(anAccount());
    }
  });
});
