import { Account } from './account';

describe('Account interface', () => {
  it('should create a typed account object', () => {
    const acc: Account = {
      id: 1,
      ownerName: 'Test User',
      ownerEmail: 'test@example.com',
      accountNumber: 'ACC123',
      currency: 'CAD',
      balance: 1000,
      status: 'ACTIVE',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };

    expect(acc).toBeTruthy();
  });
});
