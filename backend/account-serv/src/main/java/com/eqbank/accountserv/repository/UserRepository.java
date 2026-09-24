package com.eqbank.accountserv.repository;

import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    long countByRole(Role role);

    @Query("""
            select u from User u
            where lower(u.email) like :pattern or lower(u.fullName) like :pattern
            """)
    Page<User> search(@Param("pattern") String pattern, Pageable pageable);
}
