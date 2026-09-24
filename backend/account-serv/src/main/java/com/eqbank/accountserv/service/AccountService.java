package com.eqbank.accountserv.service;

import com.eqbank.accountserv.config.BankingProperties;
import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.domain.User;
import com.eqbank.accountserv.dto.AccountResponse;
import com.eqbank.accountserv.dto.MoneyMovementRequest;
import com.eqbank.accountserv.dto.OpenAccountRequest;
import com.eqbank.accountserv.dto.PageResponse;
import com.eqbank.accountserv.dto.TransactionResponse;
import com.eqbank.accountserv.exception.BusinessRuleException;
import com.eqbank.accountserv.exception.ResourceNotFoundException;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.repository.TransactionRepository;
import com.eqbank.accountserv.repository.UserRepository;
import com.eqbank.accountserv.security.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static com.eqbank.accountserv.repository.TransactionSpecifications.createdBefore;
import static com.eqbank.accountserv.repository.TransactionSpecifications.createdFrom;
import static com.eqbank.accountserv.repository.TransactionSpecifications.forAccount;
import static com.eqbank.accountserv.repository.TransactionSpecifications.ofType;

@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AccountRepository accounts;
    private final UserRepository users;
    private final TransactionRepository transactions;
    private final AccountAccess access;
    private final LedgerService ledger;
    private final AccountNumberGenerator numberGenerator;
    private final BankingProperties properties;
    private final Clock clock;

    public AccountService(AccountRepository accounts,
                          UserRepository users,
                          TransactionRepository transactions,
                          AccountAccess access,
                          LedgerService ledger,
                          AccountNumberGenerator numberGenerator,
                          BankingProperties properties,
                          Clock clock) {
        this.accounts = accounts;
        this.users = users;
        this.transactions = transactions;
        this.access = access;
        this.ledger = ledger;
        this.numberGenerator = numberGenerator;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public AccountResponse open(AuthenticatedUser caller, OpenAccountRequest request) {
        User owner = users.findById(caller.id())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + caller.id()));

        long openCount = accounts.countByOwnerIdAndStatusNot(owner.getId(), AccountStatus.CLOSED);
        if (openCount >= properties.maxOpenAccounts()) {
            throw new BusinessRuleException("You can hold at most " + properties.maxOpenAccounts() + " open accounts");
        }

        BigDecimal rate = request.type() == AccountType.SAVINGS
                ? properties.savingsInterestRate()
                : BigDecimal.ZERO;
        String nickname = hasText(request.nickname()) ? request.nickname().trim() : defaultNickname(request.type());

        Account account = accounts.save(new Account(
                numberGenerator.next(),
                owner,
                nickname,
                request.type(),
                request.currency(),
                rate.setScale(2),
                properties.dailyWithdrawalLimit().setScale(2),
                clock.instant()));

        if (request.initialDeposit() != null) {
            ledger.credit(account, TransactionType.DEPOSIT, request.initialDeposit(), "Initial deposit", null,
                    References.newReference());
        }

        log.info("Opened {} account {} for user {}", account.getType(), account.getAccountNumber(), owner.getId());
        return toResponse(account);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> listOwn(AuthenticatedUser caller) {
        return accounts.findByOwnerIdOrderByCreatedAtDesc(caller.id()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AccountResponse get(AuthenticatedUser caller, Long accountId) {
        return toResponse(access.load(caller, accountId));
    }

    @Transactional
    public AccountResponse rename(AuthenticatedUser caller, Long accountId, String nickname) {
        Account account = access.load(caller, accountId);
        account.rename(nickname.trim(), clock.instant());
        return toResponse(account);
    }

    @Transactional
    public AccountResponse deposit(AuthenticatedUser caller, Long accountId, MoneyMovementRequest request) {
        Account account = access.loadForUpdate(caller, accountId);
        ledger.credit(account, TransactionType.DEPOSIT, request.amount(),
                descriptionOr(request.description(), "Deposit"), null, References.newReference());
        return toResponse(account);
    }

    @Transactional
    public AccountResponse withdraw(AuthenticatedUser caller, Long accountId, MoneyMovementRequest request) {
        Account account = access.loadForUpdate(caller, accountId);
        ledger.debit(account, TransactionType.WITHDRAWAL, request.amount(),
                descriptionOr(request.description(), "Withdrawal"), null, References.newReference());
        return toResponse(account);
    }

    @Transactional
    public AccountResponse freeze(AuthenticatedUser caller, Long accountId) {
        Account account = access.loadForUpdate(caller, accountId);
        account.freeze(clock.instant());
        log.info("Account {} frozen by user {}", account.getAccountNumber(), caller.id());
        return toResponse(account);
    }

    @Transactional
    public AccountResponse unfreeze(AuthenticatedUser caller, Long accountId) {
        Account account = access.loadForUpdate(caller, accountId);
        account.unfreeze(clock.instant());
        log.info("Account {} unfrozen by user {}", account.getAccountNumber(), caller.id());
        return toResponse(account);
    }

    @Transactional
    public AccountResponse close(AuthenticatedUser caller, Long accountId) {
        Account account = access.loadForUpdate(caller, accountId);
        account.close(clock.instant());
        log.info("Account {} closed by user {}", account.getAccountNumber(), caller.id());
        return toResponse(account);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> transactions(AuthenticatedUser caller,
                                                          Long accountId,
                                                          TransactionType type,
                                                          LocalDate from,
                                                          LocalDate to,
                                                          int page,
                                                          int size) {
        access.load(caller, accountId);
        validateRange(from, to);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), clampSize(size),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return PageResponse.of(
                transactions.findAll(forAccount(accountId)
                        .and(ofType(type))
                        .and(createdFrom(startOf(from)))
                        .and(createdBefore(endOf(to))), pageable),
                TransactionResponse::from);
    }

    @Transactional(readOnly = true)
    public List<Transaction> statementEntries(AuthenticatedUser caller, Long accountId, LocalDate from, LocalDate to) {
        access.load(caller, accountId);
        validateRange(from, to);
        if (from.plusYears(1).isBefore(to)) {
            throw new BusinessRuleException("Statements can cover at most one year");
        }
        return transactions.findByAccountIdAndCreatedAtBetweenOrderByCreatedAtAscIdAsc(
                accountId, startOf(from), endOf(to));
    }

    AccountResponse toResponse(Account account) {
        return AccountResponse.from(account, ledger.withdrawnToday(account));
    }

    static int clampSize(int size) {
        return Math.min(Math.max(size, 1), 100);
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BusinessRuleException("'from' date must be on or before 'to' date");
        }
    }

    private static Instant startOf(LocalDate date) {
        return date == null ? null : date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /** Exclusive upper bound: start of the day after {@code date}. */
    private static Instant endOf(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String defaultNickname(AccountType type) {
        return type == AccountType.SAVINGS ? "High Interest Savings" : "Everyday Chequing";
    }

    private static String descriptionOr(String description, String fallback) {
        return hasText(description) ? description.trim() : fallback;
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
