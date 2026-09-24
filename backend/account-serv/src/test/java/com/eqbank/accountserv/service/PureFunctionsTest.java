package com.eqbank.accountserv.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class PureFunctionsTest {

    @Test
    void monthlyInterestIsBalanceTimesRateOverTwelveRoundedHalfEven() {
        assertThat(InterestService.monthlyInterest(new BigDecimal("12000.00"), new BigDecimal("2.50")))
                .isEqualByComparingTo("25.00");
        // 1000 * 2.5 / 1200 = 2.08333.. -> 2.08
        assertThat(InterestService.monthlyInterest(new BigDecimal("1000.00"), new BigDecimal("2.50")))
                .isEqualByComparingTo("2.08");
        assertThat(InterestService.monthlyInterest(new BigDecimal("0.10"), new BigDecimal("2.50")))
                .isEqualByComparingTo("0.00");
    }

    @Test
    void recipientNamesAreMasked() {
        assertThat(TransferService.maskName("Jordan Lee")).isEqualTo("Jordan L.");
        assertThat(TransferService.maskName("  Mary Ann  van der berg ")).isEqualTo("Mary B.");
        assertThat(TransferService.maskName("Cher")).isEqualTo("Cher");
    }

    @Test
    void csvEscapingQuotesAndBlocksFormulaInjection() {
        assertThat(StatementService.escape(null)).isEmpty();
        assertThat(StatementService.escape("Groceries")).isEqualTo("Groceries");
        assertThat(StatementService.escape("Rent, May")).isEqualTo("\"Rent, May\"");
        assertThat(StatementService.escape("He said \"hi\"")).isEqualTo("\"He said \"\"hi\"\"\"");
        assertThat(StatementService.escape("=HYPERLINK(\"x\")")).isEqualTo("\"'=HYPERLINK(\"\"x\"\")\"");
        assertThat(StatementService.escape("-5")).isEqualTo("'-5");
    }
}
