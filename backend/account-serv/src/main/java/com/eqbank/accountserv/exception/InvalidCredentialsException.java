package com.eqbank.accountserv.exception;

/**
 * Thrown when login credentials are wrong (HTTP 401).
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
