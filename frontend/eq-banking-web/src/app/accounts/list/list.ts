import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Account, AccountService } from '../../services/account';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list.html',
  styleUrls: ['./list.scss']
})
export class ListComponent {

  accounts: Account[] = [];
  loading = false;
  error: string | null = null;
  isDarkMode = false;

  // form model
  ownerName = '';
  ownerEmail = '';
  initialBalance = 1000;
  currency = 'CAD';

  constructor(
    private accountService: AccountService,
    private toast: ToastService
  ) {
    this.loadAccounts();
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      this.toggleTheme();
    }
  }

  get totalBalance(): number {
    return this.accounts
      .filter(a => a.status === 'ACTIVE')
      .reduce((sum, acc) => sum + acc.balance, 0);
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  loadAccounts(): void {
    this.loading = true;
    this.error = null;

    this.accountService.getAll().subscribe({
      next: data => {
        this.accounts = data;
        this.loading = false;
      },
      error: err => {
        console.error(err);
        this.error = 'Failed to load accounts';
        this.toast.error('Failed to load accounts');
        this.loading = false;
      }
    });
  }

  createAccount(): void {
    this.error = null;

    this.accountService.create({
      ownerName: this.ownerName,
      ownerEmail: this.ownerEmail,
      initialBalance: this.initialBalance,
      currency: this.currency.toUpperCase()
    }).subscribe({
      next: () => {
        this.ownerName = '';
        this.ownerEmail = '';
        this.initialBalance = 1000;
        this.currency = 'CAD';

        this.toast.success('Account created successfully');
        this.loadAccounts();
      },
      error: err => {
        console.error(err);

        if (err.status === 400 && err.error) {
          const messages = Object.values(err.error as Record<string, string>);
          const msg = messages.join(' | ');
          this.error = msg;
          this.toast.error(msg);
        } else {
          this.error = 'Create failed';
          this.toast.error('Create failed');
        }
      }
    });
  }

  quickDeposit(acc: Account): void {
    this.error = null;

    this.accountService.deposit(acc.id, 100).subscribe({
      next: () => {
        this.toast.success(`Deposited 100 into ${acc.accountNumber}`);
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Deposit failed';
        this.toast.error('Deposit failed');
      }
    });
  }

  quickWithdraw(acc: Account): void {
    this.error = null;

    this.accountService.withdraw(acc.id, 50).subscribe({
      next: () => {
        this.toast.success(`Withdrew 50 from ${acc.accountNumber}`);
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Withdraw failed';
        this.toast.error('Withdraw failed');
      }
    });
  }

  freeze(acc: Account): void {
    this.error = null;

    this.accountService.freeze(acc.id).subscribe({
      next: () => {
        this.toast.success(`Account ${acc.accountNumber} frozen`);
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Freeze failed';
        this.toast.error('Freeze failed');
      }
    });
  }

  unfreeze(acc: Account): void {
    this.error = null;

    this.accountService.unfreeze(acc.id).subscribe({
      next: () => {
        this.toast.success(`Account ${acc.accountNumber} unfrozen`);
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Unfreeze failed';
        this.toast.error('Unfreeze failed');
      }
    });
  }

  close(acc: Account): void {
    this.error = null;

    this.accountService.close(acc.id).subscribe({
      next: () => {
        this.toast.success(`Account ${acc.accountNumber} closed`);
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Close failed';
        this.toast.error('Close failed');
      }
    });
  }
}
