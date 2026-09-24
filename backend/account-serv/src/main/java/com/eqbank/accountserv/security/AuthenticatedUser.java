package com.eqbank.accountserv.security;

import com.eqbank.accountserv.domain.Role;

/**
 * The caller identity extracted from a validated access token.
 */
public record AuthenticatedUser(Long id, String email, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
