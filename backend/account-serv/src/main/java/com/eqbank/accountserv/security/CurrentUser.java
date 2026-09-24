package com.eqbank.accountserv.security;

import com.eqbank.accountserv.domain.Role;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {

    public AuthenticatedUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new AuthenticationCredentialsNotFoundException("No authenticated user");
        }
        return new AuthenticatedUser(
                Long.valueOf(jwt.getSubject()),
                jwt.getClaimAsString(TokenService.EMAIL_CLAIM),
                Role.valueOf(jwt.getClaimAsString(TokenService.ROLE_CLAIM)));
    }
}
