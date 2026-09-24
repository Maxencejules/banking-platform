package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OpenAccountRequest(
        @NotNull AccountType type,
        @NotNull CurrencyCode currency,
        @Size(max = 40) String nickname,
        @DecimalMin(value = Amounts.MIN) @DecimalMax(Amounts.MAX) @Digits(integer = 7, fraction = 2)
        BigDecimal initialDeposit
) {}
