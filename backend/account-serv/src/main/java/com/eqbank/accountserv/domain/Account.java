package com.eqbank.accountserv.domain;

import com.eqbank.accountserv.exception.BusinessRuleException;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "accounts")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "account_number", nullable = false, unique = true, length = 12)
    private String accountNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(length = 40)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private CurrencyCode currency;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status;

    @Column(name = "interest_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal interestRate;

    @Column(name = "daily_withdrawal_limit", nullable = false, precision = 19, scale = 2)
    private BigDecimal dailyWithdrawalLimit;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Version
    private long version;

    protected Account() {}

    public Account(String accountNumber,
                   User owner,
                   String nickname,
                   AccountType type,
                   CurrencyCode currency,
                   BigDecimal interestRate,
                   BigDecimal dailyWithdrawalLimit,
                   Instant now) {
        this.accountNumber = accountNumber;
        this.owner = owner;
        this.nickname = nickname;
        this.type = type;
        this.currency = currency;
        this.balance = BigDecimal.ZERO.setScale(2);
        this.status = AccountStatus.ACTIVE;
        this.interestRate = interestRate;
        this.dailyWithdrawalLimit = dailyWithdrawalLimit;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void credit(BigDecimal amount, Instant now) {
        requireActive("receive funds");
        balance = balance.add(amount);
        updatedAt = now;
    }

    public void debit(BigDecimal amount, Instant now) {
        requireActive("send or withdraw funds");
        if (balance.compareTo(amount) < 0) {
            throw new BusinessRuleException("Insufficient funds");
        }
        balance = balance.subtract(amount);
        updatedAt = now;
    }

    public void freeze(Instant now) {
        if (status != AccountStatus.ACTIVE) {
            throw new BusinessRuleException("Only ACTIVE accounts can be frozen");
        }
        status = AccountStatus.FROZEN;
        updatedAt = now;
    }

    public void unfreeze(Instant now) {
        if (status != AccountStatus.FROZEN) {
            throw new BusinessRuleException("Only FROZEN accounts can be unfrozen");
        }
        status = AccountStatus.ACTIVE;
        updatedAt = now;
    }

    public void close(Instant now) {
        if (status == AccountStatus.CLOSED) {
            throw new BusinessRuleException("Account is already closed");
        }
        if (balance.signum() != 0) {
            throw new BusinessRuleException(
                    "Account balance must be 0.00 before closing (current balance: " + balance + ")");
        }
        status = AccountStatus.CLOSED;
        closedAt = now;
        updatedAt = now;
    }

    public void rename(String nickname, Instant now) {
        if (status == AccountStatus.CLOSED) {
            throw new BusinessRuleException("Closed accounts cannot be modified");
        }
        this.nickname = nickname;
        this.updatedAt = now;
    }

    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }

    private void requireActive(String action) {
        if (status != AccountStatus.ACTIVE) {
            throw new BusinessRuleException(
                    "Account " + accountNumber + " is " + status + " and cannot " + action);
        }
    }

    public Long getId() { return id; }
    public String getAccountNumber() { return accountNumber; }
    public User getOwner() { return owner; }
    public String getNickname() { return nickname; }
    public AccountType getType() { return type; }
    public CurrencyCode getCurrency() { return currency; }
    public BigDecimal getBalance() { return balance; }
    public AccountStatus getStatus() { return status; }
    public BigDecimal getInterestRate() { return interestRate; }
    public BigDecimal getDailyWithdrawalLimit() { return dailyWithdrawalLimit; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getClosedAt() { return closedAt; }
}
