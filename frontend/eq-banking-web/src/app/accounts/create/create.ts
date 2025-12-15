import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create.html',
  styleUrls: ['./create.scss']
})
export class Create {
  name = '';
  email = '';
  initialBalance = 1000;
  currency = 'CAD';

  createAccount(): void {
    // You can wire this to AccountService later if you want.
    console.log('createAccount clicked', {
      name: this.name,
      email: this.email,
      initialBalance: this.initialBalance,
      currency: this.currency
    });
  }
}
