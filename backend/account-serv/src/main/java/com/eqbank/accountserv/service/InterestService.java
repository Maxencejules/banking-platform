package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;
import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.dto.InterestRunResponse;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.Map;

/**
 * Pays monthly interest on savings accounts: {@code balance * annualRate / 12}, rounded half-even
 * to the cent. Each account is credited at most once per calendar month, so re-running is safe.
 * Accounts opened during the current month earn their first interest in the following month's run.
 */
@Service
public class InterestService {

    private static final Logger log = LoggerFactory.getLogger(InterestService.class);
    private static final BigDecimal MONTHS_PER_YEAR = BigDecimal.valueOf(12);
    private static final BigDecimal PERCENT = BigDecimal.valueOf(100);

    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final LedgerService ledger;
    private final Clock clock;

    public InterestService(AccountRepository accounts, TransactionRepository transactions,
                           LedgerService ledger, Clock clock) {
        this.accounts = accounts;
        this.transactions = transactions;
        this.ledger = ledger;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.banking.interest-cron:0 0 3 1 * *}", zone = "UTC")
    public void scheduledRun() {
        InterestRunResponse result = runMonthlyInterest();
        log.info("Scheduled interest run credited {} accounts: {}", result.accountsCredited(), result.totalInterest());
    }

    @Transactional
    public InterestRunResponse runMonthlyInterest() {
        Instant now = clock.instant();
        YearMonth month = YearMonth.now(clock);
        Instant monthStart = month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<CurrencyCode, BigDecimal> totals = new EnumMap<>(CurrencyCode.class);
        int credited = 0;

        for (Long accountId : accounts.findIdsForInterest(AccountType.SAVINGS, AccountStatus.ACTIVE, monthStart)) {
            if (transactions.existsByAccountIdAndTypeAndCreatedAtGreaterThanEqual(
                    accountId, TransactionType.INTEREST, monthStart)) {
                continue;
            }
            Account account = accounts.findByIdForUpdate(accountId).orElseThrow();
            BigDecimal interest = monthlyInterest(account.getBalance(), account.getInterestRate());
            if (interest.signum() <= 0 || account.getStatus() != AccountStatus.ACTIVE) {
                continue;
            }
            ledger.credit(account, TransactionType.INTEREST, interest, "Interest " + month.minusMonths(1), null,
                    References.newReference());
            totals.merge(account.getCurrency(), interest, BigDecimal::add);
            credited++;
        }
        return new InterestRunResponse(credited, totals, now);
    }

    static BigDecimal monthlyInterest(BigDecimal balance, BigDecimal annualRatePercent) {
        return balance.multiply(annualRatePercent)
                .divide(PERCENT.multiply(MONTHS_PER_YEAR), 2, RoundingMode.HALF_EVEN);
    }
}
