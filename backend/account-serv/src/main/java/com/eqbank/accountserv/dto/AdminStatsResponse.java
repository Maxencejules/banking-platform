package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.CurrencyCode;

import java.math.BigDecimal;
import java.util.Map;

public record AdminStatsResponse(
        long totalCustomers,
        long totalAccounts,
        long activeAccounts,
        long frozenAccounts,
        long closedAccounts,
        Map<CurrencyCode, BigDecimal> depositsByCurrency
) {}
