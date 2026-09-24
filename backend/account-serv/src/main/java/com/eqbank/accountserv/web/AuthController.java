package com.eqbank.accountserv.web;

import com.eqbank.accountserv.dto.AuthResponse;
import com.eqbank.accountserv.dto.LoginRequest;
import com.eqbank.accountserv.dto.RegisterRequest;
import com.eqbank.accountserv.dto.UserResponse;
import com.eqbank.accountserv.security.CurrentUser;
import com.eqbank.accountserv.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentUser currentUser;

    public AuthController(AuthService authService, CurrentUser currentUser) {
        this.authService = authService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Register a new customer and receive an access token")
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @Operation(summary = "Exchange email and password for an access token")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Profile of the authenticated user")
    @GetMapping("/me")
    public UserResponse me() {
        return authService.me(currentUser.get().id());
    }
}
