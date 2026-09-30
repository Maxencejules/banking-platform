import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEST_API, aPage, aUser, anAccount, seedSession } from '../../../testing/fixtures';
import { API_BASE_URL } from '../../core/api/api-config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { ToastService } from '../../core/ui/toast.service';
import { AdminComponent } from './admin';

describe('AdminComponent account controls', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let component: AdminComponent;
  let http: HttpTestingController;
  const account = anAccount({ balance: 100 });
  const stats = {
    totalCustomers: 1, totalAccounts: 1, activeAccounts: 1, frozenAccounts: 0,
    closedAccounts: 0, depositsByCurrency: { CAD: 100 },
  };

  beforeEach(async () => {
    localStorage.clear();
    seedSession(aUser({ role: 'ADMIN', fullName: 'Operations Admin' }));
    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(), provideRouter([]),
        { provide: API_BASE_URL, useValue: TEST_API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    http.expectOne(`${TEST_API}/admin/stats`).flush(stats);
    http.expectOne((request) => request.url === `${TEST_API}/admin/accounts`).flush(aPage([account]));
    http.expectOne((request) => request.url === `${TEST_API}/admin/users`).flush(aPage([aUser()]));
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('suppresses duplicate actions in flight and renders the returned account state', async () => {
    component['accountAction'](account, 'freeze');
    const request = http.expectOne(`${TEST_API}/accounts/3/freeze`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    component['accountAction'](account, 'freeze');
    http.expectNone(`${TEST_API}/accounts/3/freeze`);
    expect(component['rowBusy']()).toBe(3);
    request.flush({ ...account, status: 'FROZEN' });
    http.expectOne(`${TEST_API}/admin/stats`).flush({ ...stats, activeAccounts: 0, frozenAccounts: 1 });
    await fixture.whenStable();

    expect(component['rowBusy']()).toBeNull();
    expect(component['accounts']().data?.content[0].status).toBe('FROZEN');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Frozen');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(account.ownerName);
  });

  it('keeps the previous account state and releases the busy control after a failed action', async () => {
    const errorToast = vi.spyOn(TestBed.inject(ToastService), 'error');
    component['accountAction'](account, 'freeze');
    http.expectOne(`${TEST_API}/accounts/3/freeze`)
      .flush({ detail: 'The account changed. Reload and retry.' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(component['rowBusy']()).toBeNull();
    expect(component['accounts']().data?.content[0].status).toBe('ACTIVE');
    expect(errorToast).toHaveBeenCalledWith('The account changed. Reload and retry.');
    http.expectNone(`${TEST_API}/admin/stats`);
    component['accountAction'](account, 'freeze');
    http.expectOne(`${TEST_API}/accounts/3/freeze`)
      .flush({ detail: 'Still unavailable' }, { status: 503, statusText: 'Unavailable' });
  });
});
