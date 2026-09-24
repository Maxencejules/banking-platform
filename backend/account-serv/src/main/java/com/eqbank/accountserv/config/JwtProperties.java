package com.eqbank.accountserv.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * @param secret HMAC signing secret; must be at least 32 bytes
 * @param issuer value of the {@code iss} claim
 * @param ttl    lifetime of issued access tokens
 */
@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(
        String secret,
        @DefaultValue("mj-banking") String issuer,
        @DefaultValue("1h") Duration ttl
) {

    public JwtProperties {
        if (secret == null || secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.security.jwt.secret must be set and at least 32 bytes long");
        }
    }
}
