package com.eqbank.accountserv.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CreateAccountRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        factory.close();
    }

    @Test
    void allFieldsNull_shouldFailValidation() {
        // your DTO only has a no-args constructor + getters, so we rely on defaults
        CreateAccountRequest request = new CreateAccountRequest();

        Set<ConstraintViolation<CreateAccountRequest>> violations = validator.validate(request);

        // At least one constraint should fail (name, email, balance, currency, etc.)
        assertThat(violations).isNotEmpty();
    }
}
