package com.eqbank.accountserv.service;

import java.util.Locale;
import java.util.UUID;

public final class References {

    private References() {}

    /** A complete random UUID, with a ledger prefix; never truncate its random bits. */
    public static String newReference() {
        return "TX-" + UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
    }
}
