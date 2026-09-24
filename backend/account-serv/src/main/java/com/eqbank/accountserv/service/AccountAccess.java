package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.exception.ResourceNotFoundException;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.security.AuthenticatedUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Loads accounts on behalf of a caller and enforces that customers can only reach their own
 * accounts, while administrators can reach any account.
 */
@Component
public class AccountAccess {

    private final AccountRepository accounts;

    public AccountAccess(AccountRepository accounts) {
        this.accounts = accounts;
    }

    public Account load(AuthenticatedUser caller, Long accountId) {
        Account account = accounts.findWithOwnerById(accountId)
                .orElseThrow(() -> notFound(accountId));
        check(caller, account);
        return account;
    }

    public Account loadForUpdate(AuthenticatedUser caller, Long accountId) {
        Account account = accounts.findByIdForUpdate(accountId)
                .orElseThrow(() -> notFound(accountId));
        check(caller, account);
        return account;
    }

    private static void check(AuthenticatedUser caller, Account account) {
        if (!caller.isAdmin() && !account.isOwnedBy(caller.id())) {
            throw new AccessDeniedException("Account " + account.getId() + " does not belong to user " + caller.id());
        }
    }

    private static ResourceNotFoundException notFound(Long id) {
        return new ResourceNotFoundException("Account not found: " + id);
    }
}
