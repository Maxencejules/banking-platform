import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEST_API, anAccount, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../../core/api/api-config';
import { TransferResponse } from '../../core/api/models';
import { IDEMPOTENCY_HEADER } from '../../core/api/transfer.service';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { TransferComponent } from './transfer';

describe('TransferComponent', () => {
  let fixture: ComponentFixture<TransferComponent>;
  let component: TransferComponent;
  let http: HttpTestingController;
  let el: HTMLElement;

  const source = anAccount({ id: 3, accountNumber: '100000000017', balance: 1000 });
  const frozen = anAccount({ id: 8, accountNumber: '100000000090', status: 'FROZEN' });

  beforeEach(async () => {
    localStorage.clear();
    seedSession();
    TestBed.configureTestingModule({
      imports: [TransferComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TransferComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    http.expectOne(`${TEST_API}/accounts`).flush([source, frozen]);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  async function fillAndReview(amount = 200): Promise<void> {
    component['form'].patchValue({ toAccountNumber: '1000 0000 0025', amount, description: 'Rent share' });
    component['continueToReview']();
    const lookup = http.expectOne((r) => r.url === `${TEST_API}/transfers/recipient`);
    expect(lookup.request.params.get('accountNumber')).toBe('100000000025');
    lookup.flush({ accountNumber: '100000000025', displayName: 'Jordan L.', currency: 'CAD' });
    await fixture.whenStable();
  }

  function expectTransfer(): TestRequest {
    const req = http.expectOne(`${TEST_API}/transfers`);
    expect(req.request.method).toBe('POST');
    return req;
  }

  it('only offers ACTIVE accounts and preselects the single one', () => {
    const options = Array.from(el.querySelectorAll('#transfer-from option')).map((o) => o.textContent ?? '');
    expect(options.some((o) => o.includes('0017'))).toBe(true);
    expect(options.some((o) => o.includes('0090'))).toBe(false);
    expect(component['form'].controls.fromAccountId.value).toBe(3);
  });

  it('shows the masked recipient name on the review step', async () => {
    await fillAndReview();
    expect(component['step']()).toBe('review');
    expect(el.textContent).toContain('Jordan L.');
    expect(el.textContent).toContain('Review your transfer');
  });

  it('reuses the Idempotency-Key when retrying the same review, and uses a new one after editing', async () => {
    await fillAndReview();

    component['confirm']();
    const first = expectTransfer();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.request.body).toEqual({
      fromAccountId: 3,
      toAccountNumber: '100000000025',
      amount: 200,
      description: 'Rent share',
    });
    first.error(new ProgressEvent('error'), { status: 0, statusText: 'Network error' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Try again');

    component['confirm']();
    const retry = expectTransfer();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
    retry.flush({ detail: 'Temporary failure' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    // Editing the amount starts a new attempt; the verified recipient is reused (no second lookup).
    component['backToDetails']();
    component['form'].patchValue({ amount: 150 });
    component['continueToReview']();
    await fixture.whenStable();
    http.expectNone((r) => r.url === `${TEST_API}/transfers/recipient`);
    expect(component['step']()).toBe('review');
    component['confirm']();
    const edited = expectTransfer();
    expect(edited.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    expect(edited.request.body.amount).toBe(150);
    edited.flush({}, { status: 500, statusText: 'Server Error' });
  });

  it('shows a receipt with the reference on success', async () => {
    await fillAndReview();
    component['confirm']();
    const response: TransferResponse = {
      reference: 'TX-7F3A9C21B4',
      fromAccount: { ...source, balance: 800 },
      toAccountNumber: '100000000025',
      amount: 200,
      currency: 'CAD',
      description: 'Rent share',
      createdAt: '2026-09-24T14:03:11.123Z',
    };
    expectTransfer().flush(response, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(component['step']()).toBe('done');
    expect(el.textContent).toContain('Transfer complete');
    expect(el.textContent).toContain('TX-7F3A9C21B4');
    expect(el.textContent).toContain('Jordan L.');
  });

  it('blocks sending to a different currency', async () => {
    component['form'].patchValue({ toAccountNumber: '100000000025', amount: 10 });
    component['continueToReview']();
    http
      .expectOne((r) => r.url === `${TEST_API}/transfers/recipient`)
      .flush({ accountNumber: '100000000025', displayName: 'Jordan L.', currency: 'USD' });
    await fixture.whenStable();

    expect(component['step']()).toBe('details');
    expect(el.textContent).toContain('Transfers must be in the same currency');
  });

  it('rejects sending to the same account and amounts above the balance', async () => {
    component['form'].patchValue({ toAccountNumber: '100000000017', amount: 5000 });
    component['continueToReview']();
    await fixture.whenStable();

    expect(el.textContent).toContain('Choose a different account');
    expect(el.textContent).toContain('Amount exceeds the available balance.');
    http.expectNone((r) => r.url === `${TEST_API}/transfers/recipient`);
  });
});
