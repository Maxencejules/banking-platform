package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;

import java.math.BigDecimal;
import java.time.Instant;

public record AccountResponse(
        Long id,
        String accountNumber,
        String nickname,
        AccountType type,
        CurrencyCode currency,
        BigDecimal balance,
        AccountStatus status,
        BigDecimal interestRate,
        BigDecimal dailyWithdrawalLimit,
        BigDecimal withdrawnToday,
        Long ownerId,
        String ownerName,
        String ownerEmail,
        Instant createdAt,
        Instant updatedAt,
        Instant closedAt
) {

    public static AccountResponse from(Account account, BigDecimal withdrawnToday) {
        return new AccountResponse(
                account.getId(),
                account.getAccountNumber(),
                account.getNickname(),
                account.getType(),
                account.getCurrency(),
                account.getBalance(),
                account.getStatus(),
                account.getInterestRate(),
                account.getDailyWithdrawalLimit(),
                withdrawnToday,
                account.getOwner().getId(),
                account.getOwner().getFullName(),
                account.getOwner().getEmail(),
                account.getCreatedAt(),
                account.getUpdatedAt(),
                account.getClosedAt());
    }
}
