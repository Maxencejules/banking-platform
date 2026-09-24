package com.eqbank.accountserv.dto;

import com.eqbank.accountserv.domain.CurrencyCode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public record InterestRunResponse(int accountsCredited, Map<CurrencyCode, BigDecimal> totalInterest, Instant runAt) {}
