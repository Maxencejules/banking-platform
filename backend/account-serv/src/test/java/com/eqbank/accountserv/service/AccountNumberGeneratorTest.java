package com.eqbank.accountserv.service;

import com.eqbank.accountserv.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class AccountNumberGeneratorTest {

    @Test
    void luhnCheckDigitMatchesKnownValue() {
        // Classic Luhn example: 7992739871 -> check digit 3
        assertThat(AccountNumberGenerator.luhnCheckDigit("7992739871")).isEqualTo(3);
    }

    @Test
    void generatedNumbersAreTwelveDigitsAndPassLuhn() {
        AccountRepository repo = Mockito.mock(AccountRepository.class);
        when(repo.existsByAccountNumber(anyString())).thenReturn(false);
        AccountNumberGenerator generator = new AccountNumberGenerator(repo);

        for (int i = 0; i < 500; i++) {
            String number = generator.next();
            assertThat(number).matches("[1-9]\\d{11}");
            assertThat(AccountNumberGenerator.isValid(number)).isTrue();
        }
    }

    @Test
    void singleDigitTyposAreDetected() {
        AccountRepository repo = Mockito.mock(AccountRepository.class);
        String number = new AccountNumberGenerator(repo).next();
        char[] chars = number.toCharArray();
        chars[5] = chars[5] == '9' ? '0' : (char) (chars[5] + 1);

        assertThat(AccountNumberGenerator.isValid(new String(chars))).isFalse();
    }

    @Test
    void retriesOnCollision() {
        AccountRepository repo = Mockito.mock(AccountRepository.class);
        when(repo.existsByAccountNumber(anyString())).thenReturn(true, true, false);

        assertThat(new AccountNumberGenerator(repo).next()).hasSize(12);
        Mockito.verify(repo, Mockito.times(3)).existsByAccountNumber(anyString());
    }
}
