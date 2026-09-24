package com.eqbank.accountserv.repository;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.User;
import jakarta.persistence.criteria.Join;
import org.springframework.data.jpa.domain.Specification;

import java.util.Locale;

public final class AccountSpecifications {

    private AccountSpecifications() {}

    public static Specification<Account> hasStatus(AccountStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    /** Matches account number, owner name or owner email (case-insensitive, partial). */
    public static Specification<Account> matches(String q) {
        return (root, query, cb) -> {
            if (q == null || q.isBlank()) {
                return null;
            }
            String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
            Join<Account, User> owner = root.join("owner");
            return cb.or(
                    cb.like(root.get("accountNumber"), pattern),
                    cb.like(cb.lower(owner.get("fullName")), pattern),
                    cb.like(cb.lower(owner.get("email")), pattern));
        };
    }
}
