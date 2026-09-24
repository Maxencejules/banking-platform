package com.eqbank.accountserv.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record TransferRequest(
        @NotNull Long fromAccountId,
        @NotBlank @Pattern(regexp = "^\\d{12}$", message = "must be a 12-digit account number") String toAccountNumber,
        @NotNull @DecimalMin(Amounts.MIN) @DecimalMax(Amounts.MAX) @Digits(integer = 7, fraction = 2)
        BigDecimal amount,
        @Size(max = 140) String description
) {}
