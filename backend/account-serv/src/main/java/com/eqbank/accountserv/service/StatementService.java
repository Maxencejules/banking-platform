package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Renders account statements as RFC 4180 CSV.
 */
@Service
public class StatementService {

    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private final AccountService accountService;

    public StatementService(AccountService accountService) {
        this.accountService = accountService;
    }

    public String csv(AuthenticatedUser caller, Long accountId, LocalDate from, LocalDate to) {
        List<Transaction> entries = accountService.statementEntries(caller, accountId, from, to);
        StringBuilder out = new StringBuilder("Date (UTC),Reference,Type,Description,Counterparty,Amount,Balance\r\n");
        for (Transaction tx : entries) {
            String signedAmount = (tx.getType().isCredit() ? "" : "-") + tx.getAmount().toPlainString();
            out.append(TIMESTAMP.format(tx.getCreatedAt())).append(',')
                    .append(tx.getReference()).append(',')
                    .append(tx.getType()).append(',')
                    .append(escape(tx.getDescription())).append(',')
                    .append(tx.getCounterpartyAccountNumber() == null ? "" : tx.getCounterpartyAccountNumber())
                    .append(',')
                    .append(signedAmount).append(',')
                    .append(tx.getBalanceAfter().toPlainString())
                    .append("\r\n");
        }
        return out.toString();
    }

    static String escape(String value) {
        if (value == null) {
            return "";
        }
        // Neutralise spreadsheet formula injection, then apply CSV quoting.
        String safe = value.matches("(?s)^[=+\\-@\\t\\r].*") ? "'" + value : value;
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n") || safe.contains("\r")) {
            return "\"" + safe.replace("\"", "\"\"") + "\"";
        }
        return safe;
    }
}
