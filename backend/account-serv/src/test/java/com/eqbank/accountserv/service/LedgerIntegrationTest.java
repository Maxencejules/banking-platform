package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;
import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.domain.User;
import com.eqbank.accountserv.dto.AccountResponse;
import com.eqbank.accountserv.dto.InterestRunResponse;
import com.eqbank.accountserv.dto.MoneyMovementRequest;
import com.eqbank.accountserv.dto.OpenAccountRequest;
import com.eqbank.accountserv.dto.TransactionResponse;
import com.eqbank.accountserv.dto.TransferRequest;
import com.eqbank.accountserv.exception.BusinessRuleException;
import com.eqbank.accountserv.repository.UserRepository;
import com.eqbank.accountserv.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Import(LedgerIntegrationTest.ClockOverride.class)
class LedgerIntegrationTest {

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-01-15T12:00:00Z"));
        }
    }

    @Autowired MutableClock clock;
    @Autowired UserRepository users;
    @Autowired AccountService accounts;
    @Autowired TransferService transfers;
    @Autowired InterestService interest;
    @Autowired InterestScheduler interestScheduler;

    @BeforeEach
    void resetClock() {
        clock.set(Instant.parse("2026-01-15T12:00:00Z"));
    }

    @Test
    void concurrentWithdrawalsNeverOverdraw() throws Exception {
        AuthenticatedUser owner = customer();
        AccountResponse acc = accounts.open(owner,
                new OpenAccountRequest(AccountType.CHECKING, CurrencyCode.CAD, null, new BigDecimal("1000.00")));

        List<Callable<Boolean>> tasks = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            tasks.add(() -> {
                try {
                    accounts.withdraw(owner, acc.id(), new MoneyMovementRequest(new BigDecimal("100.00"), null));
                    return true;
                } catch (BusinessRuleException e) {
                    return false;
                }
            });
        }
        int succeeded = 0;
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            for (Future<Boolean> f : pool.invokeAll(tasks)) {
                if (f.get()) {
                    succeeded++;
                }
            }
        }

        assertThat(succeeded).isEqualTo(10);
        assertThat(accounts.get(owner, acc.id()).balance()).isEqualByComparingTo("0.00");
        assertThat(accounts.transactions(owner, acc.id(), null, null, null, 0, 100).totalElements()).isEqualTo(11);
    }

    @Test
    void concurrentOppositeTransfersConserveMoneyWithoutDeadlock() throws Exception {
        AuthenticatedUser alice = customer();
        AuthenticatedUser bob = customer();
        AccountResponse a = accounts.open(alice,
                new OpenAccountRequest(AccountType.CHECKING, CurrencyCode.CAD, null, new BigDecimal("500.00")));
        AccountResponse b = accounts.open(bob,
                new OpenAccountRequest(AccountType.CHECKING, CurrencyCode.CAD, null, new BigDecimal("500.00")));

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            tasks.add(() -> transfers.transfer(alice,
                    new TransferRequest(a.id(), b.accountNumber(), new BigDecimal("3.00"), null), null));
            tasks.add(() -> transfers.transfer(bob,
                    new TransferRequest(b.id(), a.accountNumber(), new BigDecimal("2.00"), null), null));
        }
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            for (Future<Object> f : pool.invokeAll(tasks)) {
                f.get(); // rethrows if any transfer failed (e.g. deadlock)
            }
        }

        BigDecimal balanceA = accounts.get(alice, a.id()).balance();
        BigDecimal balanceB = accounts.get(bob, b.id()).balance();
        assertThat(balanceA).isEqualByComparingTo("475.00");
        assertThat(balanceB).isEqualByComparingTo("525.00");
    }

    @Test
    void monthlyInterestIsPaidOncePerMonthAndSkipsNewAccounts() {
        AuthenticatedUser saver = customer();
        AccountResponse savings = accounts.open(saver,
                new OpenAccountRequest(AccountType.SAVINGS, CurrencyCode.CAD, null, new BigDecimal("12000.00")));
        AccountResponse chequing = accounts.open(saver,
                new OpenAccountRequest(AccountType.CHECKING, CurrencyCode.CAD, null, new BigDecimal("12000.00")));

        // Same month the account was opened: not yet eligible.
        interest.runMonthlyInterest();
        assertThat(accounts.get(saver, savings.id()).balance()).isEqualByComparingTo("12000.00");

        clock.set(Instant.parse("2026-02-01T03:00:00Z"));
        InterestRunResponse first = interest.runMonthlyInterest();
        assertThat(first.accountsCredited()).isGreaterThanOrEqualTo(1);
        assertThat(accounts.get(saver, savings.id()).balance()).isEqualByComparingTo("12025.00");
        assertThat(accounts.get(saver, chequing.id()).balance()).isEqualByComparingTo("12000.00");

        TransactionResponse entry = accounts.transactions(saver, savings.id(), null, null, null, 0, 1).content().getFirst();
        assertThat(entry.description()).isEqualTo("Interest 2026-01");
        assertThat(entry.balanceAfter()).isEqualByComparingTo("12025.00");

        clock.set(Instant.parse("2026-02-20T10:00:00Z"));
        interest.runMonthlyInterest();
        assertThat(accounts.get(saver, savings.id()).balance()).isEqualByComparingTo("12025.00");
    }

    @Test
    void scheduledInterestRunPaysInterestInsideATransaction() {
        AuthenticatedUser saver = customer();
        AccountResponse savings = accounts.open(saver,
                new OpenAccountRequest(AccountType.SAVINGS, CurrencyCode.CAD, null, new BigDecimal("2400.00")));

        clock.set(Instant.parse("2026-02-01T03:00:00Z"));
        interestScheduler.runMonthlyInterest();

        assertThat(accounts.get(saver, savings.id()).balance()).isEqualByComparingTo("2405.00");
    }

    @Test
    void concurrentInterestRunsCreditEachAccountOnlyOnce() throws Exception {
        AuthenticatedUser saver = customer();
        AccountResponse savings = accounts.open(saver,
                new OpenAccountRequest(AccountType.SAVINGS, CurrencyCode.CAD, null, new BigDecimal("1200.00")));

        clock.set(Instant.parse("2026-02-01T03:00:00Z"));
        List<Callable<InterestRunResponse>> runs = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            runs.add(interest::runMonthlyInterest);
        }
        try (ExecutorService pool = Executors.newFixedThreadPool(6)) {
            for (Future<InterestRunResponse> f : pool.invokeAll(runs)) {
                f.get();
            }
        }

        assertThat(accounts.get(saver, savings.id()).balance()).isEqualByComparingTo("1202.50");
        assertThat(accounts.transactions(saver, savings.id(),
                com.eqbank.accountserv.domain.TransactionType.INTEREST, null, null, 0, 10).totalElements())
                .isEqualTo(1);
    }

    @Test
    void dailyLimitResetsAtUtcMidnight() {
        AuthenticatedUser owner = customer();
        AccountResponse acc = accounts.open(owner,
                new OpenAccountRequest(AccountType.CHECKING, CurrencyCode.CAD, null, new BigDecimal("9000.00")));
        accounts.withdraw(owner, acc.id(), new MoneyMovementRequest(new BigDecimal("5000.00"), null));

        clock.set(Instant.parse("2026-01-15T23:59:59Z"));
        assertThat(accounts.get(owner, acc.id()).withdrawnToday()).isEqualByComparingTo("5000.00");

        clock.set(Instant.parse("2026-01-16T00:00:00Z"));
        assertThat(accounts.get(owner, acc.id()).withdrawnToday()).isEqualByComparingTo("0.00");
        accounts.withdraw(owner, acc.id(), new MoneyMovementRequest(new BigDecimal("4000.00"), null));
    }

    private AuthenticatedUser customer() {
        String email = UUID.randomUUID() + "@example.com";
        User user = users.save(new User(email, "x", "Test Customer", Role.CUSTOMER, clock.instant()));
        return new AuthenticatedUser(user.getId(), email, Role.CUSTOMER);
    }
}
