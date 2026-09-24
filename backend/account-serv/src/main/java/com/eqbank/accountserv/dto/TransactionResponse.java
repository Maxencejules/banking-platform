package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionResponse(
        Long id,
        String reference,
        TransactionType type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        String description,
        String counterpartyAccountNumber,
        Instant createdAt
) {

    public static TransactionResponse from(Transaction tx) {
        return new TransactionResponse(tx.getId(), tx.getReference(), tx.getType(), tx.getAmount(),
                tx.getBalanceAfter(), tx.getDescription(), tx.getCounterpartyAccountNumber(), tx.getCreatedAt());
    }
}
