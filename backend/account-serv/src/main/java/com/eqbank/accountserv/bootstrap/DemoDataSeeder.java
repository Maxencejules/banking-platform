package com.eqbank.accountserv.bootstrap;

import com.eqbank.accountserv.config.BankingProperties;
import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;
import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.domain.User;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.repository.TransactionRepository;
import com.eqbank.accountserv.repository.UserRepository;
import com.eqbank.accountserv.service.AccountNumberGenerator;
import com.eqbank.accountserv.service.References;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Random;

/**
 * Seeds demo users with ~90 days of believable account history so the UI is not empty on first run.
 * Enabled with {@code app.demo-data.enabled=true} (on by default in the dev profile) and only runs
 * against an empty database.
 */
@Component
@ConditionalOnBooleanProperty("app.demo-data.enabled")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final int HISTORY_DAYS = 90;

    private final UserRepository users;
    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final AccountNumberGenerator numberGenerator;
    private final PasswordEncoder passwordEncoder;
    private final BankingProperties banking;
    private final Clock clock;
    private final Random random = new Random(42);

    public DemoDataSeeder(UserRepository users,
                          AccountRepository accounts,
                          TransactionRepository transactions,
                          AccountNumberGenerator numberGenerator,
                          PasswordEncoder passwordEncoder,
                          BankingProperties banking,
                          Clock clock) {
        this.users = users;
        this.accounts = accounts;
        this.transactions = transactions;
        this.numberGenerator = numberGenerator;
        this.passwordEncoder = passwordEncoder;
        this.banking = banking;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate start = today.minusDays(HISTORY_DAYS);
        Instant opened = at(start, 9, 0);

        user("admin@mjbank.dev", "Admin123!", "Operations Admin", Role.ADMIN, opened);
        User alex = user("alex@example.com", "Password123!", "Alex Martin", Role.CUSTOMER, opened);
        User jordan = user("jordan@example.com", "Password123!", "Jordan Lee", Role.CUSTOMER, opened);
        User priya = user("priya@example.com", "Password123!", "Priya Shah", Role.CUSTOMER, opened);

        Account alexChequing = account(alex, "Everyday Chequing", AccountType.CHECKING, CurrencyCode.CAD, opened);
        Account alexSavings = account(alex, "Emergency Fund", AccountType.SAVINGS, CurrencyCode.CAD, opened);
        Account alexUsd = account(alex, "Travel USD", AccountType.CHECKING, CurrencyCode.USD, opened);
        Account jordanChequing = account(jordan, "Everyday Chequing", AccountType.CHECKING, CurrencyCode.CAD, opened);
        Account jordanSavings = account(jordan, "House Down Payment", AccountType.SAVINGS, CurrencyCode.CAD, opened);
        Account priyaChequing = account(priya, "Everyday Chequing", AccountType.CHECKING, CurrencyCode.CAD, opened);

        credit(alexChequing, TransactionType.DEPOSIT, "3000.00", "Initial deposit", null, opened);
        credit(alexSavings, TransactionType.DEPOSIT, "8500.00", "Initial deposit", null, opened.plusSeconds(60));
        credit(alexUsd, TransactionType.DEPOSIT, "1200.00", "Initial deposit", null, opened.plusSeconds(120));
        credit(jordanChequing, TransactionType.DEPOSIT, "2200.00", "Initial deposit", null, opened);
        credit(jordanSavings, TransactionType.DEPOSIT, "15000.00", "Initial deposit", null, opened.plusSeconds(60));
        credit(priyaChequing, TransactionType.DEPOSIT, "640.00", "Initial deposit", null, opened);

        for (LocalDate day = start.plusDays(1); day.isBefore(today); day = day.plusDays(1)) {
            int dayIndex = (int) (day.toEpochDay() - start.toEpochDay());

            if (day.getDayOfMonth() == 1) {
                interest(alexSavings, day);
                interest(jordanSavings, day);
                debit(alexChequing, TransactionType.WITHDRAWAL, "1650.00", "Rent - Maple Property Mgmt", null,
                        at(day, 8, 5));
                debit(jordanChequing, TransactionType.WITHDRAWAL, "1375.00", "Rent - Harbourview Apartments", null,
                        at(day, 8, 40));
            }
            if (dayIndex % 14 == 3) {
                credit(alexChequing, TransactionType.DEPOSIT, "2450.00", "Payroll - Northwind Ltd", null,
                        at(day, 6, 30));
                credit(jordanChequing, TransactionType.DEPOSIT, "1980.00", "Payroll - Bluewater Health", null,
                        at(day, 6, 45));
            }
            if (dayIndex % 14 == 4) {
                transfer(alexChequing, alexSavings, "400.00", "Auto-save", at(day, 7, 0));
                transfer(jordanChequing, jordanSavings, "300.00", "House fund", at(day, 7, 15));
            }
            if (dayIndex % 7 == 5) {
                debit(alexChequing, TransactionType.WITHDRAWAL, money(70, 160), "Groceries - FreshCo", null,
                        at(day, 18, 20));
                debit(jordanChequing, TransactionType.WITHDRAWAL, money(50, 130), "Groceries - No Frills", null,
                        at(day, 17, 55));
            }
            if (dayIndex % 10 == 2) {
                debit(alexChequing, TransactionType.WITHDRAWAL, money(20, 60), "ATM withdrawal", null,
                        at(day, 12, 10));
            }
            if (dayIndex % 30 == 12) {
                debit(alexChequing, TransactionType.WITHDRAWAL, "85.00", "Phone - Rogers", null, at(day, 9, 0));
                debit(alexChequing, TransactionType.WITHDRAWAL, "62.40", "Hydro - Toronto Hydro", null,
                        at(day, 9, 5));
                debit(alexUsd, TransactionType.WITHDRAWAL, money(15, 45), "Streaming subscription", null,
                        at(day, 10, 0));
            }
            if (dayIndex % 21 == 9) {
                transfer(alexChequing, jordanChequing, money(25, 70), "Dinner split", at(day, 21, 30));
            }
            if (dayIndex % 30 == 20) {
                credit(priyaChequing, TransactionType.DEPOSIT, "900.00", "Freelance - Studio Nine", null,
                        at(day, 11, 0));
            }
        }

        // One customer's account is frozen to demonstrate account lifecycle states.
        priyaChequing.freeze(at(today.minusDays(2), 16, 0));

        log.info("Seeded demo data: {} users, {} accounts, {} transactions",
                users.count(), accounts.count(), transactions.count());
    }

    private User user(String email, String password, String name, Role role, Instant createdAt) {
        return users.save(new User(email, passwordEncoder.encode(password), name, role, createdAt));
    }

    private Account account(User owner, String nickname, AccountType type, CurrencyCode currency, Instant openedAt) {
        BigDecimal rate = type == AccountType.SAVINGS ? banking.savingsInterestRate() : BigDecimal.ZERO;
        return accounts.save(new Account(numberGenerator.next(), owner, nickname, type, currency,
                rate.setScale(2), banking.dailyWithdrawalLimit().setScale(2), openedAt));
    }

    private void credit(Account account, TransactionType type, String amount, String description,
                        String counterparty, Instant at) {
        credit(account, type, new BigDecimal(amount), description, counterparty, at, References.newReference());
    }

    private void credit(Account account, TransactionType type, BigDecimal amount, String description,
                        String counterparty, Instant at, String reference) {
        account.credit(amount, at);
        transactions.save(new Transaction(account, reference, type, amount, description, counterparty, at));
    }

    private void debit(Account account, TransactionType type, String amount, String description,
                       String counterparty, Instant at) {
        debit(account, type, new BigDecimal(amount), description, counterparty, at, References.newReference());
    }

    private void debit(Account account, TransactionType type, BigDecimal amount, String description,
                       String counterparty, Instant at, String reference) {
        if (account.getBalance().compareTo(amount) < 0) {
            return; // keep the demo ledger consistent: never overdraw
        }
        account.debit(amount, at);
        transactions.save(new Transaction(account, reference, type, amount, description, counterparty, at));
    }

    private void transfer(Account from, Account to, String amount, String description, Instant at) {
        BigDecimal value = new BigDecimal(amount);
        if (from.getBalance().compareTo(value) < 0) {
            return;
        }
        String reference = References.newReference();
        debit(from, TransactionType.TRANSFER_OUT, value, description, to.getAccountNumber(), at, reference);
        credit(to, TransactionType.TRANSFER_IN, value, description, from.getAccountNumber(), at, reference);
    }

    private void interest(Account savings, LocalDate day) {
        BigDecimal interest = savings.getBalance().multiply(savings.getInterestRate())
                .divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_EVEN);
        if (interest.signum() > 0) {
            credit(savings, TransactionType.INTEREST, interest, "Interest " + day.minusMonths(1).getYear() + "-"
                    + String.format("%02d", day.minusMonths(1).getMonthValue()), null, at(day, 3, 0),
                    References.newReference());
        }
    }

    private String money(int min, int max) {
        int cents = min * 100 + random.nextInt((max - min) * 100);
        return BigDecimal.valueOf(cents, 2).toPlainString();
    }

    private static Instant at(LocalDate day, int hour, int minute) {
        return day.atTime(LocalTime.of(hour, minute)).toInstant(ZoneOffset.UTC);
    }
}
