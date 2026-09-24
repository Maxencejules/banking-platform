package com.eqbank.accountserv.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.math.BigDecimal;

/**
 * Product configuration for accounts.
 *
 * @param dailyWithdrawalLimit default per-account limit on withdrawals + outgoing transfers per UTC day
 * @param savingsInterestRate  annual interest rate (percent) for new savings accounts
 * @param maxOpenAccounts      maximum number of non-closed accounts per customer
 */
@ConfigurationProperties(prefix = "app.banking")
public record BankingProperties(
        @DefaultValue("5000.00") BigDecimal dailyWithdrawalLimit,
        @DefaultValue("2.50") BigDecimal savingsInterestRate,
        @DefaultValue("10") int maxOpenAccounts
) {}
