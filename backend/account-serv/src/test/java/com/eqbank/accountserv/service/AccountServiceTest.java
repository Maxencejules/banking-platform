package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class AccountServiceTest {

    @Autowired
    private AccountService accountService;

    @Autowired
    private AccountRepository accountRepository;

    @Test
    void createAccount_persistsWithCorrectDefaults() {
        // when
        Account account = accountService.createAccount(
                "Max Test",
                "max@example.com",
                new BigDecimal("1000.00"),
                "CAD"
        );

        // then
        assertThat(account.getId()).isNotNull();
        assertThat(account.getOwnerName()).isEqualTo("Max Test");
        assertThat(account.getOwnerEmail()).isEqualTo("max@example.com");
        assertThat(account.getBalance()).isEqualByComparingTo("1000.00");
        assertThat(account.getCurrency()).isEqualTo("CAD");
        assertEquals("ACTIVE", account.getStatus(), "Status should be ACTIVE");


        // and it is actually in the DB
        Account reloaded = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(reloaded.getBalance()).isEqualByComparingTo("1000.00");
    }

    @Test
    void deposit_increasesBalanceForActiveAccount() {
        Account account = accountService.createAccount(
                "Max Test",
                "max@example.com",
                new BigDecimal("500.00"),
                "CAD"
        );

        Account updated = accountService.deposit(account.getId(), new BigDecimal("250.00"));

        assertThat(updated.getBalance()).isEqualByComparingTo("750.00");
    }

    @Test
    void deposit_negativeAmount_throwsException() {
        Account account = accountService.createAccount(
                "Max Test",
                "max@example.com",
                new BigDecimal("500.00"),
                "CAD"
        );

        assertThrows(IllegalArgumentException.class,
                () -> accountService.deposit(account.getId(), new BigDecimal("-10.00")));
    }
}
