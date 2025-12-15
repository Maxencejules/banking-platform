import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Account, AccountService } from '../../services/account';

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

  // form model
  ownerName = '';
  ownerEmail = '';
  initialBalance = 1000;
  currency = 'CAD';

  constructor(private accountService: AccountService) {
    this.loadAccounts();
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
        this.loadAccounts();
      },
      error: err => {
        console.error(err);
        this.error = 'Create failed';
      }
    });
  }

  quickDeposit(acc: Account): void {
    this.accountService.deposit(acc.id, 100).subscribe({
      next: () => this.loadAccounts(),
      error: err => {
        console.error(err);
        this.error = 'Deposit failed';
      }
    });
  }

  quickWithdraw(acc: Account): void {
    this.accountService.withdraw(acc.id, 50).subscribe({
      next: () => this.loadAccounts(),
      error: err => {
        console.error(err);
        this.error = 'Withdraw failed';
      }
    });
  }

  freeze(acc: Account): void {
    this.accountService.freeze(acc.id).subscribe({
      next: () => this.loadAccounts(),
      error: err => {
        console.error(err);
        this.error = 'Freeze failed';
      }
    });
  }

  unfreeze(acc: Account): void {
    this.accountService.unfreeze(acc.id).subscribe({
      next: () => this.loadAccounts(),
      error: err => {
        console.error(err);
        this.error = 'Unfreeze failed';
      }
    });
  }

  close(acc: Account): void {
    this.accountService.close(acc.id).subscribe({
      next: () => this.loadAccounts(),
      error: err => {
        console.error(err);
        this.error = 'Close failed';
      }
    });
  }
}
