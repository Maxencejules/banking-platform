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

    private String generateAccountNumber() {
        long num = (long) (Math.random() * 1_000_000_0000L);
        return String.format("%010d", num);
    }
}
