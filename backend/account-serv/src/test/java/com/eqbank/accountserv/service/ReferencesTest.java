package com.eqbank.accountserv.service;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReferencesTest {
    @Test
    void referenceContainsACompleteRandomUuidRatherThanATruncatedPrefix() {
        String reference = References.newReference();
        assertThat(reference).startsWith("TX-").hasSize(39);
        UUID identifier = UUID.fromString(reference.substring(3));
        assertThat(identifier.version()).isEqualTo(4);
        assertThat(identifier.variant()).isEqualTo(2);
    }
}
