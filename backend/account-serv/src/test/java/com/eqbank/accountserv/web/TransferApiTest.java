package com.eqbank.accountserv.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransferApiTest extends IntegrationTestSupport {

    @Test
    void transferMovesMoneyAndWritesBothLegsWithSharedReference() throws Exception {
        String alex = registerCustomer("Alex Martin");
        String jordan = registerCustomer("Jordan Lee");
        OpenedAccount from = openAccount(alex, "CHECKING", "CAD", "500");
        OpenedAccount to = openAccount(jordan, "CHECKING", "CAD", null);

        mvc.perform(authed(get("/api/transfers/recipient?accountNumber=" + to.number()), alex))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Jordan L."))
                .andExpect(jsonPath("$.currency").value("CAD"));

        String reference = read(mvc.perform(authed(post("/api/transfers"), alex)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("{\"fromAccountId\":%d,\"toAccountNumber\":\"%s\",\"amount\":125.75,\"description\":\"Rent share\"}",
                                from.id(), to.number())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fromAccount.balance").value(374.25))
                .andExpect(jsonPath("$.amount").value(125.75))
                .andExpect(jsonPath("$.currency").value("CAD"))
                .andExpect(jsonPath("$.toAccountNumber").value(to.number()))
                .andReturn(), "$.reference");

        mvc.perform(authed(get("/api/accounts/" + to.id()), jordan))
                .andExpect(jsonPath("$.balance").value(125.75));
        mvc.perform(authed(get("/api/accounts/" + to.id() + "/transactions"), jordan))
                .andExpect(jsonPath("$.content[0].type").value("TRANSFER_IN"))
                .andExpect(jsonPath("$.content[0].reference").value(reference))
                .andExpect(jsonPath("$.content[0].counterpartyAccountNumber").value(from.number()));
        mvc.perform(authed(get("/api/accounts/" + from.id() + "/transactions?type=TRANSFER_OUT"), alex))
                .andExpect(jsonPath("$.content[0].reference").value(reference));
    }

    @Test
    void idempotencyKeyPreventsDoubleSpend() throws Exception {
        String alex = registerCustomer("Alex Martin");
        OpenedAccount from = openAccount(alex, "CHECKING", "CAD", "100");
        OpenedAccount to = openAccount(alex, "SAVINGS", "CAD", null);
        String body = json("{\"fromAccountId\":%d,\"toAccountNumber\":\"%s\",\"amount\":40}", from.id(), to.number());

        String first = read(mvc.perform(authed(post("/api/transfers"), alex).header("Idempotency-Key", "abc-123")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn(), "$.reference");
        mvc.perform(authed(post("/api/transfers"), alex).header("Idempotency-Key", "abc-123")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").value(first))
                .andExpect(jsonPath("$.fromAccount.balance").value(60.00));

        mvc.perform(authed(post("/api/transfers"), alex).header("Idempotency-Key", "abc-123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("{\"fromAccountId\":%d,\"toAccountNumber\":\"%s\",\"amount\":41}", from.id(), to.number())))
                .andExpect(status().isConflict());

        mvc.perform(authed(get("/api/accounts/" + to.id()), alex)).andExpect(jsonPath("$.balance").value(40.00));
    }

    @Test
    void transferRules() throws Exception {
        String alex = registerCustomer("Alex Martin");
        String jordan = registerCustomer("Jordan Lee");
        OpenedAccount cad = openAccount(alex, "CHECKING", "CAD", "100");
        OpenedAccount usd = openAccount(alex, "CHECKING", "USD", "100");
        OpenedAccount jordanCad = openAccount(jordan, "CHECKING", "CAD", "100");
        String t = "{\"fromAccountId\":%d,\"toAccountNumber\":\"%s\",\"amount\":%s}";

        // cross-currency
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), usd.number(), "10")))
                .andExpect(status().isUnprocessableContent());
        // same account
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), cad.number(), "10")))
                .andExpect(status().isUnprocessableContent());
        // insufficient funds
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), jordanCad.number(), "100.01")))
                .andExpect(status().isUnprocessableContent());
        // spending from someone else's account
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, jordanCad.id(), cad.number(), "1")))
                .andExpect(status().isForbidden());
        // unknown destination
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), "100000000000", "1")))
                .andExpect(status().isNotFound());
        // malformed destination
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), "12AB", "1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.toAccountNumber").exists());
        // frozen destination
        mvc.perform(authed(post("/api/accounts/" + jordanCad.id() + "/freeze"), jordan)).andExpect(status().isOk());
        mvc.perform(authed(post("/api/transfers"), alex).contentType(MediaType.APPLICATION_JSON)
                        .content(json(t, cad.id(), jordanCad.number(), "1")))
                .andExpect(status().isUnprocessableContent());

        mvc.perform(authed(get("/api/accounts/" + cad.id()), alex)).andExpect(jsonPath("$.balance").value(100.00));
    }

    @Test
    void recipientLookupValidatesAndHidesUnknownAccounts() throws Exception {
        String alex = registerCustomer("Alex Martin");
        mvc.perform(authed(get("/api/transfers/recipient?accountNumber=abc"), alex))
                .andExpect(status().isBadRequest());
        mvc.perform(authed(get("/api/transfers/recipient?accountNumber=100000000000"), alex))
                .andExpect(status().isNotFound());
    }
}
