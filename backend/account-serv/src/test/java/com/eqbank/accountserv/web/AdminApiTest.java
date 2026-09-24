package com.eqbank.accountserv.web;

import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminApiTest extends IntegrationTestSupport {

    @Test
    void customersCannotUseAdminEndpoints() throws Exception {
        String customer = registerCustomer("Regular Customer");
        mvc.perform(authed(get("/api/admin/stats"), customer)).andExpect(status().isForbidden());
        mvc.perform(authed(get("/api/admin/accounts"), customer)).andExpect(status().isForbidden());
        mvc.perform(authed(post("/api/admin/interest/run"), customer)).andExpect(status().isForbidden());
    }

    @Test
    void adminCanSearchAndManageAnyAccount() throws Exception {
        String admin = createAdminAndLogin();
        String customer = registerCustomer("Zelda Quartermain");
        OpenedAccount acc = openAccount(customer, "CHECKING", "CAD", "50");

        mvc.perform(authed(get("/api/admin/accounts?q=quartermain"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].accountNumber").value(acc.number()));
        mvc.perform(authed(get("/api/admin/accounts?q=" + acc.number()), admin))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(authed(get("/api/admin/users?q=zelda"), admin))
                .andExpect(jsonPath("$.content[0].fullName").value("Zelda Quartermain"));

        mvc.perform(authed(post("/api/accounts/" + acc.id() + "/freeze"), admin))
                .andExpect(jsonPath("$.status").value("FROZEN"));
        mvc.perform(authed(get("/api/admin/accounts?status=FROZEN&q=quartermain"), admin))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(authed(get("/api/accounts/" + acc.id() + "/transactions"), admin))
                .andExpect(status().isOk());

        mvc.perform(authed(get("/api/admin/stats"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCustomers").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.frozenAccounts").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.depositsByCurrency.CAD").exists());
    }

    @Test
    void interestRunIsIdempotentWithinAMonth() throws Exception {
        String admin = createAdminAndLogin();
        mvc.perform(authed(post("/api/admin/interest/run"), admin)).andExpect(status().isOk());
        mvc.perform(authed(post("/api/admin/interest/run"), admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountsCredited").value(0));
    }
}
