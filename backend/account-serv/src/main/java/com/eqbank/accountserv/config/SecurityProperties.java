package com.eqbank.accountserv.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.util.List;

/**
 * @param allowedOrigins     browser origins allowed to call the API (CORS)
 * @param loginLockDuration  how long a user is locked out after too many failed logins
 */
@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(
        @DefaultValue("http://localhost:4200") List<String> allowedOrigins,
        @DefaultValue("15m") Duration loginLockDuration
) {}
