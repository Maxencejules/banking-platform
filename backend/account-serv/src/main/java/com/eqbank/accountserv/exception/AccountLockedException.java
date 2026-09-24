package com.eqbank.accountserv.exception;

/**
 * Thrown when a user is temporarily locked out after repeated failed logins (HTTP 423).
 */
public class AccountLockedException extends RuntimeException {

    public AccountLockedException(String message) {
        super(message);
    }
}
