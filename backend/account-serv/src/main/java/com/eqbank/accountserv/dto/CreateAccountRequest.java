package com.eqbank.accountserv.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public class CreateAccountRequest {

    @NotBlank
    @Size(max = 100)
    private String ownerName;

    @NotBlank
    @Email
    @Size(max = 120)
    private String ownerEmail;

    @NotNull
    @PositiveOrZero
    private BigDecimal initialBalance;

    @NotBlank
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be a 3-letter ISO code")
    private String currency;

    public String getOwnerName() { return ownerName; }
    public String getOwnerEmail() { return ownerEmail; }
    public BigDecimal getInitialBalance() { return initialBalance; }
    public String getCurrency() { return currency; }
}
