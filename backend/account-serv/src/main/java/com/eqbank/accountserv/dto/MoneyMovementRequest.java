package com.eqbank.accountserv.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Body for deposits and withdrawals.
 */
public record MoneyMovementRequest(
        @NotNull @DecimalMin(Amounts.MIN) @DecimalMax(Amounts.MAX) @Digits(integer = 7, fraction = 2)
        BigDecimal amount,
        @Size(max = 140) String description
) {}
