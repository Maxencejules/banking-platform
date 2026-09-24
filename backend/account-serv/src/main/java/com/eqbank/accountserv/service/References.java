package com.eqbank.accountserv.service;

import java.util.Locale;
import java.util.UUID;

public final class References {

    private References() {}

    /** Human-friendly ledger reference, e.g. {@code TX-7F3A9C21B4}. */
    public static String newReference() {
        return "TX-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT);
    }
}
