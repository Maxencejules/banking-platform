package com.eqbank.accountserv.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateAccountRequest(@NotBlank @Size(max = 40) String nickname) {}
