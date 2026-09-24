package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.Role;
import com.eqbank.accountserv.domain.User;
import com.eqbank.accountserv.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTestSupport {

    protected static final String PASSWORD = "Password123!";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    /** Registers a fresh customer and returns their bearer token. */
    protected String registerCustomer(String fullName) throws Exception {
        String email = UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"%s","email":"%s","password":"%s"}""".formatted(fullName, email, PASSWORD)))
                .andExpect(status().isCreated())
                .andReturn();
        return read(result, "$.accessToken");
    }

    protected String createAdminAndLogin() throws Exception {
        String email = "admin-" + UUID.randomUUID().toString().substring(0, 8) + "@mjbank.dev";
        users.save(new User(email, passwordEncoder.encode(PASSWORD), "Test Admin", Role.ADMIN, Instant.now()));
        return login(email, PASSWORD);
    }

    protected String login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return read(result, "$.accessToken");
    }

    /** Opens an account and returns {id, accountNumber}. */
    protected OpenedAccount openAccount(String token, String type, String currency, String initialDeposit)
            throws Exception {
        String deposit = initialDeposit == null ? "" : ",\"initialDeposit\":" + initialDeposit;
        MvcResult result = mvc.perform(authed(post("/api/accounts"), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"%s\",\"currency\":\"%s\"%s}".formatted(type, currency, deposit)))
                .andExpect(status().isCreated())
                .andReturn();
        return new OpenedAccount(((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue(),
                read(result, "$.accountNumber"));
    }

    protected static MockHttpServletRequestBuilder authed(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    protected static String json(String template, Object... args) {
        return template.formatted(args);
    }

    protected static <T> T read(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    protected record OpenedAccount(long id, String number) {}
}
