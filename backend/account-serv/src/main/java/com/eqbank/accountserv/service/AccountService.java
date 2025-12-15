package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.repository.AccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class AccountService {

    private final AccountRepository repository;

    public AccountService(AccountRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Account createAccount(String ownerName,
                                 String ownerEmail,
                                 BigDecimal initialBalance,
                                 String currency) {

        String accountNumber = generateAccountNumber();

        Account account = new Account(
                accountNumber,
                ownerName,
                ownerEmail,
                initialBalance,
                currency,
                "ACTIVE"
        );

        return repository.save(account);
    }

    public List<Account> getAllAccounts() {
        return repository.findAll();
    }

    public Account getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + id));
    }

    @Transactional
    public Account deposit(Long accountId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive");
        }

        Account account = getById(accountId);

        if (!"ACTIVE".equals(account.getStatus())) {
            throw new IllegalArgumentException("Only ACTIVE accounts can receive deposits");
        }

        account.deposit(amount);
        return account;
    }

    @Transactional
    public Account withdraw(Long accountId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be positive");
        }

        Account account = getById(accountId);

        if (!"ACTIVE".equals(account.getStatus())) {
            throw new IllegalArgumentException("Only ACTIVE accounts can perform withdrawals");
        }

        if (account.getBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient funds");
        }

        account.withdraw(amount);
        return account;
    }

    @Transactional
    public Account freezeAccount(Long id) {
        Account account = getById(id);
        account.freeze();
        return account;
    }

    @Transactional
    public Account closeAccount(Long id) {
        Account account = getById(id);
        account.close();
        return account;
    }

    @Transactional
    public Account unfreezeAccount(Long id) {
        Account account = getById(id);
        account.unfreeze();
        return account;
    }


    private String generateAccountNumber() {
        long num = (long) (Math.random() * 1_000_000_0000L);
        return String.format("%010d", num);
    }
}
