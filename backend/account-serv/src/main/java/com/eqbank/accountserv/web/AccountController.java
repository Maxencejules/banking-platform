package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.TransactionType;
import com.eqbank.accountserv.dto.AccountResponse;
import com.eqbank.accountserv.dto.MoneyMovementRequest;
import com.eqbank.accountserv.dto.OpenAccountRequest;
import com.eqbank.accountserv.dto.PageResponse;
import com.eqbank.accountserv.dto.TransactionResponse;
import com.eqbank.accountserv.dto.UpdateAccountRequest;
import com.eqbank.accountserv.security.CurrentUser;
import com.eqbank.accountserv.service.AccountService;
import com.eqbank.accountserv.service.StatementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Accounts")
@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private static final MediaType TEXT_CSV = new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8);

    private final AccountService accounts;
    private final StatementService statements;
    private final CurrentUser currentUser;

    public AccountController(AccountService accounts, StatementService statements, CurrentUser currentUser) {
        this.accounts = accounts;
        this.statements = statements;
        this.currentUser = currentUser;
    }

    @Operation(summary = "List the caller's accounts")
    @GetMapping
    public List<AccountResponse> list() {
        return accounts.listOwn(currentUser.get());
    }

    @Operation(summary = "Open a new account")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse open(@Valid @RequestBody OpenAccountRequest request) {
        return accounts.open(currentUser.get(), request);
    }

    @GetMapping("/{id}")
    public AccountResponse get(@PathVariable Long id) {
        return accounts.get(currentUser.get(), id);
    }

    @Operation(summary = "Rename an account")
    @PatchMapping("/{id}")
    public AccountResponse update(@PathVariable Long id, @Valid @RequestBody UpdateAccountRequest request) {
        return accounts.rename(currentUser.get(), id, request.nickname());
    }

    @PostMapping("/{id}/deposit")
    public AccountResponse deposit(@PathVariable Long id, @Valid @RequestBody MoneyMovementRequest request) {
        return accounts.deposit(currentUser.get(), id, request);
    }

    @PostMapping("/{id}/withdraw")
    public AccountResponse withdraw(@PathVariable Long id, @Valid @RequestBody MoneyMovementRequest request) {
        return accounts.withdraw(currentUser.get(), id, request);
    }

    @PostMapping("/{id}/freeze")
    public AccountResponse freeze(@PathVariable Long id) {
        return accounts.freeze(currentUser.get(), id);
    }

    @PostMapping("/{id}/unfreeze")
    public AccountResponse unfreeze(@PathVariable Long id) {
        return accounts.unfreeze(currentUser.get(), id);
    }

    @Operation(summary = "Close an account (balance must be zero; irreversible)")
    @PostMapping("/{id}/close")
    public AccountResponse close(@PathVariable Long id) {
        return accounts.close(currentUser.get(), id);
    }

    @Operation(summary = "Transaction history, newest first")
    @GetMapping("/{id}/transactions")
    public PageResponse<TransactionResponse> transactions(
            @PathVariable Long id,
            @RequestParam(required = false) TransactionType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return accounts.transactions(currentUser.get(), id, type, from, to, page, size);
    }

    @Operation(summary = "Download a CSV statement for a date range")
    @GetMapping(value = "/{id}/statement", produces = "text/csv")
    public ResponseEntity<String> statement(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        String csv = statements.csv(currentUser.get(), id, from, to);
        String filename = "statement-" + id + "-" + from + "-to-" + to + ".csv";
        return ResponseEntity.ok()
                .contentType(TEXT_CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(csv);
    }
}
