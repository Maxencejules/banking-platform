package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.AccountStatus;
import com.eqbank.accountserv.dto.AccountResponse;
import com.eqbank.accountserv.dto.AdminStatsResponse;
import com.eqbank.accountserv.dto.InterestRunResponse;
import com.eqbank.accountserv.dto.PageResponse;
import com.eqbank.accountserv.dto.UserResponse;
import com.eqbank.accountserv.service.AdminService;
import com.eqbank.accountserv.service.InterestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

/**
 * Back-office endpoints. Access is restricted to ROLE_ADMIN in the security configuration.
 */
@Tag(name = "Administration")
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final InterestService interestService;

    public AdminController(AdminService adminService, InterestService interestService) {
        this.adminService = adminService;
        this.interestService = interestService;
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return adminService.stats();
    }

    @Operation(summary = "Search all accounts by number, owner name or email")
    @GetMapping("/accounts")
    public PageResponse<AccountResponse> accounts(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) AccountStatus status,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        return adminService.searchAccounts(q, status, page, size);
    }

    @GetMapping("/users")
    public PageResponse<UserResponse> users(@RequestParam(required = false) String q,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return adminService.searchUsers(q, page, size);
    }

    @Operation(summary = "Credit this month's interest to savings accounts (idempotent per month)")
    @PostMapping("/interest/run")
    public InterestRunResponse runInterest() {
        return interestService.runMonthlyInterest();
    }
}
