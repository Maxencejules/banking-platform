package com.eqbank.accountserv.web;

import com.eqbank.accountserv.dto.RecipientResponse;
import com.eqbank.accountserv.dto.TransferRequest;
import com.eqbank.accountserv.dto.TransferResponse;
import com.eqbank.accountserv.security.CurrentUser;
import com.eqbank.accountserv.service.TransferService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Transfers")
@Validated
@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final TransferService transfers;
    private final CurrentUser currentUser;

    public TransferController(TransferService transfers, CurrentUser currentUser) {
        this.transfers = transfers;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Confirm the payee of an account number before sending money")
    @GetMapping("/recipient")
    public RecipientResponse recipient(
            @RequestParam @Pattern(regexp = "^\\d{12}$", message = "must be a 12-digit account number")
            String accountNumber) {
        return transfers.lookupRecipient(accountNumber);
    }

    @Operation(summary = "Transfer money from one of the caller's accounts to any account in the bank")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransferResponse transfer(
            @Valid @RequestBody TransferRequest request,
            @RequestHeader(name = "Idempotency-Key", required = false) @Size(max = 100) String idempotencyKey) {
        return transfers.transfer(currentUser.get(), request, idempotencyKey);
    }
}
