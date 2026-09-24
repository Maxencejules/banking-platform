import { Pipe, PipeTransform } from '@angular/core';
import { AccountResponse, AccountStatus, AccountType, TransactionType } from '../core/api/models';
import {
  accountDisplayName,
  accountTypeLabel,
  groupAccountNumber,
  maskAccountNumber,
  statusLabel,
  transactionTypeLabel,
} from '../core/util/format';

/** `100000000017 | maskAccount` → `•••• 0017` */
@Pipe({ name: 'maskAccount' })
export class MaskAccountPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return maskAccountNumber(value);
  }
}

/** `100000000017 | groupAccount` → `1000 0000 0017` */
@Pipe({ name: 'groupAccount' })
export class GroupAccountPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return groupAccountNumber(value);
  }
}

/** Nickname, or a readable fallback such as "Savings account". */
@Pipe({ name: 'accountName' })
export class AccountNamePipe implements PipeTransform {
  transform(account: Pick<AccountResponse, 'nickname' | 'type'>): string {
    return accountDisplayName(account);
  }
}

@Pipe({ name: 'accountType' })
export class AccountTypePipe implements PipeTransform {
  transform(type: AccountType): string {
    return accountTypeLabel(type);
  }
}

@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(status: AccountStatus): string {
    return statusLabel(status);
  }
}

@Pipe({ name: 'txType' })
export class TransactionTypePipe implements PipeTransform {
  transform(type: TransactionType): string {
    return transactionTypeLabel(type);
  }
}
