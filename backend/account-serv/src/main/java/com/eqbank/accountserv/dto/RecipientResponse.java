package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.CurrencyCode;

/**
 * Payee confirmation: lets the sender verify who they are paying without exposing the full name.
 */
public record RecipientResponse(String accountNumber, String displayName, CurrencyCode currency) {}
