package com.eqbank.accountserv.service;

import com.eqbank.accountserv.config.SecurityProperties;
import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.domain.User;
import com.eqbank.accountserv.dto.AuthResponse;
import com.eqbank.accountserv.dto.LoginRequest;
import com.eqbank.accountserv.dto.RegisterRequest;
import com.eqbank.accountserv.dto.UserResponse;
import com.eqbank.accountserv.exception.AccountLockedException;
import com.eqbank.accountserv.exception.ConflictException;
import com.eqbank.accountserv.exception.InvalidCredentialsException;
import com.eqbank.accountserv.exception.ResourceNotFoundException;
import com.eqbank.accountserv.repository.UserRepository;
import com.eqbank.accountserv.security.TokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String INVALID_CREDENTIALS = "Invalid email or password";
    private static final String LOCKED = "Too many failed login attempts. Try again later.";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final SecurityProperties securityProperties;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(UserRepository users,
                       PasswordEncoder passwordEncoder,
                       TokenService tokenService,
                       SecurityProperties securityProperties,
                       Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.securityProperties = securityProperties;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("timing-equaliser-not-a-real-password");
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalise(request.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with this email already exists");
        }
        User user = users.save(new User(email, passwordEncoder.encode(request.password()),
                request.fullName().trim(), Role.CUSTOMER, clock.instant()));
        log.info("Registered user {}", user.getId());
        return issue(user);
    }

    /**
     * Failed attempts are persisted even though an exception is thrown, hence {@code noRollbackFor}.
     */
    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public AuthResponse login(LoginRequest request) {
        Instant now = clock.instant();
        User user = users.findByEmailIgnoreCase(normalise(request.email())).orElse(null);
        if (user == null) {
            // Spend the same time as a real check so response timing does not reveal registered emails.
            passwordEncoder.matches(request.password(), dummyHash);
            throw new InvalidCredentialsException(INVALID_CREDENTIALS);
        }
        if (user.isLocked(now)) {
            throw new AccountLockedException(LOCKED);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            user.registerFailedLogin(now, securityProperties.loginLockDuration());
            log.warn("Failed login for user {}", user.getId());
            if (user.isLocked(now)) {
                throw new AccountLockedException(LOCKED);
            }
            throw new InvalidCredentialsException(INVALID_CREDENTIALS);
        }
        user.registerSuccessfulLogin();
        return issue(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return users.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private AuthResponse issue(User user) {
        TokenService.IssuedToken token = tokenService.issue(user);
        return AuthResponse.bearer(token.value(), token.expiresAt(), UserResponse.from(user));
    }

    private static String normalise(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
