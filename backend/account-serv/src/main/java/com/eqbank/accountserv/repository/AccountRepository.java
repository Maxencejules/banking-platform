package com.eqbank.accountserv.repository;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.AccountType;
import com.eqbank.accountserv.domain.CurrencyCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long>, JpaSpecificationExecutor<Account> {

    @EntityGraph(attributePaths = "owner")
    Optional<Account> findWithOwnerById(Long id);

    @EntityGraph(attributePaths = "owner")
    Optional<Account> findByAccountNumber(String accountNumber);

    boolean existsByAccountNumber(String accountNumber);

    @Query("select a.id from Account a where a.accountNumber = :accountNumber")
    Optional<Long> findIdByAccountNumber(@Param("accountNumber") String accountNumber);

    /**
     * Loads and row-locks an account for the duration of the current transaction so that
     * concurrent balance changes are serialised.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a join fetch a.owner where a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = "owner")
    List<Account> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    long countByOwnerIdAndStatusNot(Long ownerId, AccountStatus status);

    long countByStatus(AccountStatus status);

    @Query("""
            select a.id from Account a
            where a.type = :type and a.status = :status and a.createdAt < :openedBefore
            order by a.id
            """)
    List<Long> findIdsForInterest(@Param("type") AccountType type,
                                  @Param("status") AccountStatus status,
                                  @Param("openedBefore") Instant openedBefore);

    @Query("""
            select a.currency as currency, sum(a.balance) as total
            from Account a
            where a.status <> com.eqbank.accountserv.domain.AccountStatus.CLOSED
            group by a.currency
            """)
    List<CurrencyTotal> sumBalancesByCurrency();

    interface CurrencyTotal {
        CurrencyCode getCurrency();

        BigDecimal getTotal();
    }
}
