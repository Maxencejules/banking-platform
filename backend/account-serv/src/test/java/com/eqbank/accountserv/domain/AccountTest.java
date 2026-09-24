package com.eqbank.accountserv.domain;

import com.eqbank.accountserv.exception.BusinessRuleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountTest {

    private static final Instant NOW = Instant.parse("2026-03-15T10:00:00Z");
    private Account account;

    @BeforeEach
    void setUp() {
        User owner = new User("a@example.com", "hash", "Alex Martin", Role.CUSTOMER, NOW);
        account = new Account("123456789012", owner, "Everyday", AccountType.CHECKING, CurrencyCode.CAD,
                BigDecimal.ZERO, new BigDecimal("5000.00"), NOW);
    }

    @Test
    void newAccountIsActiveWithZeroBalance() {
        assertThat(account.getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(account.getBalance()).isEqualByComparingTo("0");
    }

    @Test
    void creditAndDebitAdjustBalance() {
        account.credit(new BigDecimal("100.50"), NOW);
        account.debit(new BigDecimal("40.25"), NOW);
        assertThat(account.getBalance()).isEqualByComparingTo("60.25");
    }

    @Test
    void cannotOverdraw() {
        account.credit(new BigDecimal("10.00"), NOW);
        assertThatThrownBy(() -> account.debit(new BigDecimal("10.01"), NOW))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage("Insufficient funds");
        assertThat(account.getBalance()).isEqualByComparingTo("10.00");
    }

    @Test
    void frozenAccountRejectsMoneyMovementUntilUnfrozen() {
        account.freeze(NOW);
        assertThatThrownBy(() -> account.credit(BigDecimal.ONE, NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> account.freeze(NOW)).isInstanceOf(BusinessRuleException.class);

        account.unfreeze(NOW);
        account.credit(BigDecimal.ONE, NOW);
        assertThat(account.getBalance()).isEqualByComparingTo("1");
    }

    @Test
    void closingRequiresZeroBalanceAndIsIrreversible() {
        account.credit(BigDecimal.TEN, NOW);
        assertThatThrownBy(() -> account.close(NOW)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("must be 0.00");

        account.debit(BigDecimal.TEN, NOW);
        account.close(NOW);
        assertThat(account.getStatus()).isEqualTo(AccountStatus.CLOSED);
        assertThat(account.getClosedAt()).isEqualTo(NOW);
        assertThatThrownBy(() -> account.unfreeze(NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> account.close(NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> account.rename("x", NOW)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void userLocksAfterRepeatedFailures() {
        User user = new User("u@example.com", "hash", "U Ser", Role.CUSTOMER, NOW);
        for (int i = 0; i < User.MAX_FAILED_LOGINS - 1; i++) {
            user.registerFailedLogin(NOW, java.time.Duration.ofMinutes(15));
        }
        assertThat(user.isLocked(NOW)).isFalse();
        user.registerFailedLogin(NOW, java.time.Duration.ofMinutes(15));
        assertThat(user.isLocked(NOW)).isTrue();
        assertThat(user.isLocked(NOW.plusSeconds(15 * 60))).isFalse();
    }
}
