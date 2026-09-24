package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.IdempotencyRecord;
import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.dto.RecipientResponse;
import com.eqbank.accountserv.dto.TransferRequest;
import com.eqbank.accountserv.dto.TransferResponse;
import com.eqbank.accountserv.exception.BusinessRuleException;
import com.eqbank.accountserv.exception.ConflictException;
import com.eqbank.accountserv.exception.ResourceNotFoundException;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.repository.IdempotencyRecordRepository;
import com.eqbank.accountserv.repository.TransactionRepository;
import com.eqbank.accountserv.security.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;

@Service
public class TransferService {

    private static final Logger log = LoggerFactory.getLogger(TransferService.class);

    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final IdempotencyRecordRepository idempotencyRecords;
    private final AccountService accountService;
    private final LedgerService ledger;
    private final Clock clock;

    public TransferService(AccountRepository accounts,
                           TransactionRepository transactions,
                           IdempotencyRecordRepository idempotencyRecords,
                           AccountService accountService,
                           LedgerService ledger,
                           Clock clock) {
        this.accounts = accounts;
        this.transactions = transactions;
        this.idempotencyRecords = idempotencyRecords;
        this.accountService = accountService;
        this.ledger = ledger;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RecipientResponse lookupRecipient(String accountNumber) {
        Account account = accounts.findByAccountNumber(accountNumber)
                .filter(a -> a.getStatus() != AccountStatus.CLOSED)
                .orElseThrow(() -> new ResourceNotFoundException("No open account with number " + accountNumber));
        return new RecipientResponse(account.getAccountNumber(), maskName(account.getOwner().getFullName()),
                account.getCurrency());
    }

    @Transactional
    public TransferResponse transfer(AuthenticatedUser caller, TransferRequest request, String idempotencyKey) {
        String requestHash = hash(request);
        if (idempotencyKey != null) {
            var previous = idempotencyRecords.findByUserIdAndKey(caller.id(), idempotencyKey);
            if (previous.isPresent()) {
                if (!previous.get().getRequestHash().equals(requestHash)) {
                    throw new ConflictException("Idempotency-Key was already used for a different transfer");
                }
                return replay(previous.get().getTransferReference());
            }
        }

        Long sourceId = request.fromAccountId();
        Long destinationId = accounts.findIdByAccountNumber(request.toAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account with number " + request.toAccountNumber()));
        if (sourceId.equals(destinationId)) {
            throw new BusinessRuleException("Source and destination accounts must be different");
        }

        // Lock both rows in a globally consistent order (by id) to avoid deadlocks between
        // concurrent transfers in opposite directions. Entities are first loaded here, under the
        // lock, so the persistence context never holds a stale copy.
        Account first = lockedById(Math.min(sourceId, destinationId));
        Account second = lockedById(Math.max(sourceId, destinationId));
        Account source = first.getId().equals(sourceId) ? first : second;
        Account destination = source == first ? second : first;

        // Transfers always debit the caller's own money, even for administrators.
        if (!source.isOwnedBy(caller.id())) {
            throw new AccessDeniedException("Source account does not belong to caller");
        }
        if (source.getCurrency() != destination.getCurrency()) {
            throw new BusinessRuleException("Cross-currency transfers are not supported ("
                    + source.getCurrency() + " -> " + destination.getCurrency() + ")");
        }
        if (destination.getStatus() != AccountStatus.ACTIVE) {
            throw new BusinessRuleException("Destination account cannot receive funds");
        }

        String reference = References.newReference();
        String description = request.description() == null || request.description().isBlank()
                ? "Transfer" : request.description().trim();
        Transaction out = ledger.debit(source, TransactionType.TRANSFER_OUT, request.amount(), description,
                destination.getAccountNumber(), reference);
        ledger.credit(destination, TransactionType.TRANSFER_IN, request.amount(), description,
                source.getAccountNumber(), reference);

        if (idempotencyKey != null) {
            idempotencyRecords.save(new IdempotencyRecord(idempotencyKey, caller.id(), requestHash, reference,
                    clock.instant()));
        }

        log.info("Transfer {}: {} {} from {} to {}", reference, request.amount(), source.getCurrency(),
                source.getAccountNumber(), destination.getAccountNumber());
        return toResponse(out);
    }

    private TransferResponse replay(String reference) {
        Transaction out = transactions.findFirstByReferenceAndType(reference, TransactionType.TRANSFER_OUT)
                .orElseThrow(() -> new IllegalStateException("Missing ledger entry for " + reference));
        return toResponse(out);
    }

    private TransferResponse toResponse(Transaction out) {
        Account source = out.getAccount();
        return new TransferResponse(out.getReference(), accountService.toResponse(source),
                out.getCounterpartyAccountNumber(), out.getAmount(), source.getCurrency(), out.getDescription(),
                out.getCreatedAt());
    }

    private Account lockedById(Long id) {
        return accounts.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + id));
    }

    /** "Jordan Lee" -> "Jordan L."; single names are returned as-is. */
    static String maskName(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0];
        }
        return parts[0] + " " + parts[parts.length - 1].substring(0, 1).toUpperCase(Locale.ROOT) + ".";
    }

    private static String hash(TransferRequest request) {
        String canonical = request.fromAccountId() + "|" + request.toAccountNumber() + "|"
                + request.amount().stripTrailingZeros().toPlainString() + "|"
                + Objects.requireNonNullElse(request.description(), "");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
