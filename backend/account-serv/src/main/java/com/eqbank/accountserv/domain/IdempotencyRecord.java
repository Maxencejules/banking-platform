package com.eqbank.accountserv.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Remembers the outcome of a transfer submitted with an Idempotency-Key header so that
 * client retries never move money twice.
 */
@Entity
@Table(name = "idempotency_keys",
        uniqueConstraints = @UniqueConstraint(name = "uk_idempotency_user_key",
                columnNames = {"user_id", "idempotency_key"}))
public class IdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String key;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "transfer_reference", nullable = false, length = 20)
    private String transferReference;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected IdempotencyRecord() {}

    public IdempotencyRecord(String key, Long userId, String requestHash, String transferReference, Instant createdAt) {
        this.key = key;
        this.userId = userId;
        this.requestHash = requestHash;
        this.transferReference = transferReference;
        this.createdAt = createdAt;
    }

    public String getKey() { return key; }
    public Long getUserId() { return userId; }
    public String getRequestHash() { return requestHash; }
    public String getTransferReference() { return transferReference; }
    public Instant getCreatedAt() { return createdAt; }
}
