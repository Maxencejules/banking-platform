package com.eqbank.accountserv.service;

import com.eqbank.accountserv.repository.AccountRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * Generates unique 12-digit account numbers whose last digit is a Luhn check digit,
 * so that most typos are caught before a transfer is attempted.
 */
@Component
public class AccountNumberGenerator {

    private static final int MAX_ATTEMPTS = 20;

    private final AccountRepository accounts;
    private final SecureRandom random = new SecureRandom();

    public AccountNumberGenerator(AccountRepository accounts) {
        this.accounts = accounts;
    }

    public String next() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            StringBuilder base = new StringBuilder(11);
            base.append(1 + random.nextInt(9)); // never a leading zero
            for (int i = 1; i < 11; i++) {
                base.append(random.nextInt(10));
            }
            String candidate = base.toString() + luhnCheckDigit(base.toString());
            if (!accounts.existsByAccountNumber(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not allocate a unique account number");
    }

    public static boolean isValid(String accountNumber) {
        if (accountNumber == null || !accountNumber.matches("\\d{12}")) {
            return false;
        }
        return luhnCheckDigit(accountNumber.substring(0, 11)) == accountNumber.charAt(11) - '0';
    }

    static int luhnCheckDigit(String digits) {
        int sum = 0;
        boolean doubleIt = true; // rightmost payload digit is doubled when a check digit is appended
        for (int i = digits.length() - 1; i >= 0; i--) {
            int d = digits.charAt(i) - '0';
            if (doubleIt) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
            doubleIt = !doubleIt;
        }
        return (10 - sum % 10) % 10;
    }
}
