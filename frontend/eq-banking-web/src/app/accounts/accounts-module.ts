import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AccountsRoutingModule } from './accounts-routing-module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,          // <-- REQUIRED for ngModel
    AccountsRoutingModule
  ]
})
export class AccountsModule { }
