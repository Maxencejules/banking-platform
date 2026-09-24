package com.eqbank.accountserv.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AccountApiTest extends IntegrationTestSupport {

    @Test
    void openAccountWithInitialDepositRecordsLedgerEntry() throws Exception {
        String token = registerCustomer("Alex Martin");
        OpenedAccount acc = openAccount(token, "SAVINGS", "CAD", "250.00");

        mvc.perform(authed(get("/api/accounts/" + acc.id()), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(250.00))
                .andExpect(jsonPath("$.type").value("SAVINGS"))
                .andExpect(jsonPath("$.nickname").value("High Interest Savings"))
                .andExpect(jsonPath("$.interestRate").value(2.50))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.ownerName").value("Alex Martin"));

        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions"), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].type").value("DEPOSIT"))
                .andExpect(jsonPath("$.content[0].description").value("Initial deposit"))
                .andExpect(jsonPath("$.content[0].balanceAfter").value(250.00));
    }

    @Test
    void depositWithdrawUpdatesBalanceAndHistoryNewestFirst() throws Exception {
        String token = registerCustomer("Dee Positor");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", null);

        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/deposit"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":100.50,\"description\":\"Paycheque\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(100.50));
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":40.25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(60.25))
                .andExpect(jsonPath("$.withdrawnToday").value(40.25));

        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions?size=1"), token))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].type").value("WITHDRAWAL"))
                .andExpect(jsonPath("$.content[0].description").value("Withdrawal"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions?type=DEPOSIT"), token))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].description").value("Paycheque"));

        String tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(1).toString();
        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions?from=" + tomorrow), token))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void invalidAmountsAreRejected() throws Exception {
        String token = registerCustomer("Val Idation");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", "10");
        for (String amount : new String[]{"0", "-5", "1.234", "1000000.01", "null"}) {
            mvc.perform(authed(post("/api/accounts/" + acc.id() + "/deposit"), token)
                            .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":" + amount + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.amount").exists());
        }
    }

    @Test
    void insufficientFundsIs422AndBalanceUnchanged() throws Exception {
        String token = registerCustomer("Low Balance");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", "20");
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":20.01}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value("Insufficient funds"));
        mvc.perform(authed(get("/api/accounts/" + acc.id()), token))
                .andExpect(jsonPath("$.balance").value(20.00));
    }

    @Test
    void dailyWithdrawalLimitIsEnforced() throws Exception {
        String token = registerCustomer("Big Spender");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", "9000");
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":4000}"))
                .andExpect(status().isOk());
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1000.01}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value("Daily withdrawal limit exceeded. Remaining today: 1000.00 CAD"));
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1000.00}"))
                .andExpect(status().isOk());
    }

    @Test
    void lifecycleFreezeUnfreezeClose() throws Exception {
        String token = registerCustomer("Life Cycle");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", "5");
        String base = "/api/accounts/" + acc.id();

        mvc.perform(authed(post(base + "/freeze"), token)).andExpect(jsonPath("$.status").value("FROZEN"));
        mvc.perform(authed(post(base + "/deposit"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1}"))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(authed(post(base + "/unfreeze"), token)).andExpect(jsonPath("$.status").value("ACTIVE"));

        mvc.perform(authed(post(base + "/close"), token))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(authed(post(base + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":5}"))
                .andExpect(status().isOk());
        mvc.perform(authed(post(base + "/close"), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.closedAt").exists());
        mvc.perform(authed(post(base + "/unfreeze"), token)).andExpect(status().isUnprocessableContent());
    }

    @Test
    void renameAccount() throws Exception {
        String token = registerCustomer("Nick Name");
        OpenedAccount acc = openAccount(token, "CHECKING", "USD", null);
        mvc.perform(authed(patch("/api/accounts/" + acc.id()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"  Vacation  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("Vacation"));
        mvc.perform(authed(patch("/api/accounts/" + acc.id()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void customersCannotSeeOrTouchOtherCustomersAccounts() throws Exception {
        String owner = registerCustomer("Owner One");
        String intruder = registerCustomer("Intruder Two");
        OpenedAccount acc = openAccount(owner, "CHECKING", "CAD", "100");

        mvc.perform(authed(get("/api/accounts/" + acc.id()), intruder)).andExpect(status().isForbidden());
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), intruder)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions"), intruder))
                .andExpect(status().isForbidden());
        mvc.perform(authed(get("/api/accounts"), intruder))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(authed(get("/api/accounts/999999"), owner)).andExpect(status().isNotFound());
    }

    @Test
    void openAccountLimitIsEnforced() throws Exception {
        String token = registerCustomer("Many Accounts");
        for (int i = 0; i < 10; i++) {
            openAccount(token, "CHECKING", "CAD", null);
        }
        mvc.perform(authed(post("/api/accounts"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"CHECKING\",\"currency\":\"CAD\"}"))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void unsupportedCurrencyIsRejected() throws Exception {
        String token = registerCustomer("Euro Fan");
        mvc.perform(authed(post("/api/accounts"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"CHECKING\",\"currency\":\"EUR\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statementIsCsvWithSignedAmounts() throws Exception {
        String token = registerCustomer("State Ment");
        OpenedAccount acc = openAccount(token, "CHECKING", "CAD", "100");
        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/withdraw"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":30,\"description\":\"Books, used\"}"))
                .andExpect(status().isOk());

        String today = LocalDate.now(ZoneOffset.UTC).toString();
        MvcResult result = mvc.perform(authed(get("/api/accounts/" + acc.id() + "/statement?from=" + today + "&to=" + today), token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andReturn();
        String[] lines = result.getResponse().getContentAsString().split("\r\n");
        assertThat(lines).hasSize(3);
        assertThat(lines[0]).startsWith("Date (UTC),Reference,Type");
        assertThat(lines[1]).contains(",DEPOSIT,Initial deposit,,100.00,100.00");
        assertThat(lines[2]).contains(",WITHDRAWAL,\"Books, used\",,-30.00,70.00");

        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/statement?from=2026-02-01&to=2026-01-01"), token))
                .andExpect(status().isUnprocessableContent());
    }
}
