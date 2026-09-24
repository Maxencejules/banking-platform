package com.eqbank.accountserv.domain;

public enum TransactionType {
    DEPOSIT(true),
    WITHDRAWAL(false),
    TRANSFER_IN(true),
    TRANSFER_OUT(false),
    INTEREST(true);

    private final boolean credit;

    TransactionType(boolean credit) {
        this.credit = credit;
    }

    public boolean isCredit() {
        return credit;
    }
}
