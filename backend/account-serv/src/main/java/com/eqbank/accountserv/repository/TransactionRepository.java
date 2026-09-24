package com.eqbank.accountserv.repository;

import com.eqbank.accountserv.domain.Transaction;
import com.eqbank.accountserv.domain.TransactionType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {

    @Query("""
            select coalesce(sum(t.amount), 0) from Transaction t
            where t.account.id = :accountId
              and t.type in :types
              and t.createdAt >= :since
            """)
    BigDecimal sumAmountSince(@Param("accountId") Long accountId,
                              @Param("types") Collection<TransactionType> types,
                              @Param("since") Instant since);

    boolean existsByAccountIdAndTypeAndCreatedAtGreaterThanEqual(Long accountId, TransactionType type, Instant since);

    @EntityGraph(attributePaths = {"account", "account.owner"})
    Optional<Transaction> findFirstByReferenceAndType(String reference, TransactionType type);

    List<Transaction> findByAccountIdAndCreatedAtBetweenOrderByCreatedAtAscIdAsc(Long accountId, Instant from, Instant to);
}
