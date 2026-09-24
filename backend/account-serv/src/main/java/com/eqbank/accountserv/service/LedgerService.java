package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.exception.BusinessRuleException;
import com.eqbank.accountserv.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Set;

/**
 * The only component allowed to change balances. Every change is paired with a ledger entry
 * written in the same transaction. Callers must hold a row lock on the account.
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class LedgerService {

    static final Set<TransactionType> OUTFLOWS_COUNTED_AGAINST_LIMIT =
            EnumSet.of(TransactionType.WITHDRAWAL, TransactionType.TRANSFER_OUT);

    private final TransactionRepository transactions;
    private final Clock clock;

    public LedgerService(TransactionRepository transactions, Clock clock) {
        this.transactions = transactions;
        this.clock = clock;
    }

    public Transaction credit(Account account, TransactionType type, BigDecimal amount,
                              String description, String counterparty, String reference) {
        if (!type.isCredit()) {
            throw new IllegalArgumentException(type + " is not a credit");
        }
        Instant now = clock.instant();
        account.credit(amount, now);
        return transactions.save(new Transaction(account, reference, type, amount, description, counterparty, now));
    }

    public Transaction debit(Account account, TransactionType type, BigDecimal amount,
                             String description, String counterparty, String reference) {
        if (type.isCredit()) {
            throw new IllegalArgumentException(type + " is not a debit");
        }
        if (OUTFLOWS_COUNTED_AGAINST_LIMIT.contains(type)) {
            BigDecimal usedToday = withdrawnToday(account);
            if (usedToday.add(amount).compareTo(account.getDailyWithdrawalLimit()) > 0) {
                BigDecimal remaining = account.getDailyWithdrawalLimit().subtract(usedToday).max(BigDecimal.ZERO);
                throw new BusinessRuleException("Daily withdrawal limit exceeded. Remaining today: "
                        + remaining.setScale(2) + " " + account.getCurrency());
            }
        }
        Instant now = clock.instant();
        account.debit(amount, now);
        return transactions.save(new Transaction(account, reference, type, amount, description, counterparty, now));
    }

    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public BigDecimal withdrawnToday(Account account) {
        if (account.getId() == null) {
            return BigDecimal.ZERO.setScale(2);
        }
        Instant startOfDay = LocalDate.now(clock).atStartOfDay(ZoneOffset.UTC).toInstant();
        return transactions.sumAmountSince(account.getId(), OUTFLOWS_COUNTED_AGAINST_LIMIT, startOfDay)
                .setScale(2);
    }
}
