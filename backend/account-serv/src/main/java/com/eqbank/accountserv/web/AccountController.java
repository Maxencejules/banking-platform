package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.service.AccountService;
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
    public ResponseEntity<Account> createAccount(@RequestBody Map<String, Object> payload) {
        String ownerName = (String) payload.get("ownerName");
        String ownerEmail = (String) payload.get("ownerEmail");
        BigDecimal initialBalance = new BigDecimal(payload.get("initialBalance").toString());
        String currency = (String) payload.get("currency");

        Account created = service.createAccount(ownerName, ownerEmail, initialBalance, currency);
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
