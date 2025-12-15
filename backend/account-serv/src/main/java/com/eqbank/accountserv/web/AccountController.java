package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.dto.CreateAccountRequest;
import com.eqbank.accountserv.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Account> createAccount(
            @Valid @RequestBody CreateAccountRequest request
    ) {
        Account created = service.createAccount(
                request.getOwnerName(),
                request.getOwnerEmail(),
                request.getInitialBalance(),
                request.getCurrency()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public List<Account> getAll() {
        return service.getAllAccounts();
    }

    @GetMapping("/{id}")
    public Account getOne(@PathVariable Long id) {
        return service.getById(id);
    }
}
