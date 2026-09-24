package com.eqbank.accountserv.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    /** All business time is UTC; tests replace this bean with a fixed clock. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
