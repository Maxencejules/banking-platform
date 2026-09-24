package com.eqbank.accountserv.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Immutable ledger entry. Every balance change on an account produces exactly one entry;
 * a transfer produces two entries (one per account) sharing the same reference.
 */
@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false, updatable = false)
    private Account account;

    @Column(nullable = false, length = 20, updatable = false)
    private String reference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private TransactionType type;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal balanceAfter;

    @Column(length = 140, updatable = false)
    private String description;

    @Column(name = "counterparty_account_number", length = 12, updatable = false)
    private String counterpartyAccountNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Transaction() {}

    public Transaction(Account account,
                       String reference,
                       TransactionType type,
                       BigDecimal amount,
                       String description,
                       String counterpartyAccountNumber,
                       Instant createdAt) {
        this.account = account;
        this.reference = reference;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = account.getBalance();
        this.description = description;
        this.counterpartyAccountNumber = counterpartyAccountNumber;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Account getAccount() { return account; }
    public String getReference() { return reference; }
    public TransactionType getType() { return type; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getBalanceAfter() { return balanceAfter; }
    public String getDescription() { return description; }
    public String getCounterpartyAccountNumber() { return counterpartyAccountNumber; }
    public Instant getCreatedAt() { return createdAt; }
}
