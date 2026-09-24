package com.eqbank.accountserv.repository;

import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;

public final class TransactionSpecifications {

    private TransactionSpecifications() {}

    public static Specification<Transaction> forAccount(Long accountId) {
        return (root, query, cb) -> cb.equal(root.get("account").get("id"), accountId);
    }

    public static Specification<Transaction> ofType(TransactionType type) {
        return (root, query, cb) -> type == null ? null : cb.equal(root.get("type"), type);
    }

    public static Specification<Transaction> createdFrom(Instant from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("createdAt"), from);
    }

    public static Specification<Transaction> createdBefore(Instant to) {
        return (root, query, cb) -> to == null ? null : cb.lessThan(root.get("createdAt"), to);
    }
}
