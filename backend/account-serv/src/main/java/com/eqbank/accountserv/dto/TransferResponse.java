package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.CurrencyCode;

import java.math.BigDecimal;
import java.time.Instant;

public record TransferResponse(
        String reference,
        AccountResponse fromAccount,
        String toAccountNumber,
        BigDecimal amount,
        CurrencyCode currency,
        String description,
        Instant createdAt
) {}
