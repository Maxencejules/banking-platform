package com.eqbank.accountserv.service;

import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.domain.CurrencyCode;
import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.dto.AccountResponse;
import com.eqbank.accountserv.dto.AdminStatsResponse;
import com.eqbank.accountserv.dto.PageResponse;
import com.eqbank.accountserv.dto.UserResponse;
import com.eqbank.accountserv.repository.AccountRepository;
import com.eqbank.accountserv.repository.AccountSpecifications;
import com.eqbank.accountserv.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AdminService {

    private final AccountRepository accounts;
    private final UserRepository users;
    private final AccountService accountService;

    public AdminService(AccountRepository accounts, UserRepository users, AccountService accountService) {
        this.accounts = accounts;
        this.users = users;
        this.accountService = accountService;
    }

    public AdminStatsResponse stats() {
        Map<CurrencyCode, BigDecimal> deposits = new EnumMap<>(CurrencyCode.class);
        accounts.sumBalancesByCurrency().forEach(t -> deposits.put(t.getCurrency(), t.getTotal()));
        return new AdminStatsResponse(
                users.countByRole(Role.CUSTOMER),
                accounts.count(),
                accounts.countByStatus(AccountStatus.ACTIVE),
                accounts.countByStatus(AccountStatus.FROZEN),
                accounts.countByStatus(AccountStatus.CLOSED),
                deposits);
    }

    public PageResponse<AccountResponse> searchAccounts(String q, AccountStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), AccountService.clampSize(size),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return PageResponse.of(
                accounts.findAll(AccountSpecifications.hasStatus(status).and(AccountSpecifications.matches(q)),
                        pageable),
                accountService::toResponse);
    }

    public PageResponse<UserResponse> searchUsers(String q, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), AccountService.clampSize(size),
                Sort.by(Sort.Order.asc("fullName"), Sort.Order.asc("id")));
        String pattern = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        return PageResponse.of(users.search(pattern, pageable), UserResponse::from);
    }
}
