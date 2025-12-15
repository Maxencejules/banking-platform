package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.Account;
import com.eqbank.accountserv.dto.CreateAccountRequest;
import com.eqbank.accountserv.dto.AmountRequest;
import com.eqbank.accountserv.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "http://localhost:4200")
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

    @PostMapping("/{id}/deposit")
    public ResponseEntity<Account> deposit(
            @PathVariable Long id,
            @Valid @RequestBody AmountRequest request
    ) {
        Account updated = service.deposit(id, request.getAmount());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<Account> withdraw(
            @PathVariable Long id,
            @Valid @RequestBody AmountRequest request
    ) {
        Account updated = service.withdraw(id, request.getAmount());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/freeze")
    public ResponseEntity<Account> freeze(@PathVariable Long id) {
        return ResponseEntity.ok(service.freezeAccount(id));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<Account> close(@PathVariable Long id) {
        return ResponseEntity.ok(service.closeAccount(id));
    }

    @PostMapping("/{id}/unfreeze")
    public ResponseEntity<Account> unfreeze(@PathVariable Long id) {
        return ResponseEntity.ok(service.unfreezeAccount(id));
    }


}
