package com.eqbank.accountserv.web;

import com.eqbank.accountserv.domain.TransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Requires a real database; the PostgreSQL CI job runs the entire backend suite as well. */
@EnabledIfEnvironmentVariable(named = "BANKING_POSTGRES_TESTS", matches = "true")
@Timeout(30)
class PostgresTransferApiTest extends IntegrationTestSupport {

    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void requirePostgreSql() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
        }
    }

    @Test
    void simultaneousSameKeyRequestsAllReplayOneTransferEvenWhenOnlyOneCanBeFunded() throws Exception {
        String token = registerCustomer("Concurrent Customer");
        OpenedAccount from = openAccount(token, "CHECKING", "CAD", "60");
        OpenedAccount to = openAccount(token, "SAVINGS", "CAD", null);
        String key = UUID.randomUUID().toString();
        PendingTransfer request = new PendingTransfer(token, body(from, to, "40"), key);

        List<MvcResult> results = overlapAtAccountLock(from.id(), List.of(request, request, request, request));

        for (MvcResult result : results) {
            assertThat(result.getResponse().getStatus()).isEqualTo(201);
            assertThat((String) read(result, "$.reference")).isEqualTo(read(results.getFirst(), "$.reference"));
            assertThat(new BigDecimal(read(result, "$.amount").toString())).isEqualByComparingTo("40");
        }
        assertBalancesAndLedger(from, to, "20", "40");
        assertOneTransferPair(read(results.getFirst(), "$.reference"), from, to, new BigDecimal("40"));
        assertThat(keyCount(from, key)).isEqualTo(1);
    }

    @Test
    void simultaneousDifferentPayloadsProduceOneSuccessAndOneExplicitKeyConflict() throws Exception {
        String token = registerCustomer("Conflicting Customer");
        OpenedAccount from = openAccount(token, "CHECKING", "CAD", "100");
        OpenedAccount to = openAccount(token, "SAVINGS", "CAD", null);
        String key = UUID.randomUUID().toString();

        List<MvcResult> results = overlapAtAccountLock(from.id(), List.of(
                new PendingTransfer(token, body(from, to, "40"), key),
                new PendingTransfer(token, body(from, to, "41"), key)));

        assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList())
                .containsExactlyInAnyOrder(201, 409);
        MvcResult success = results.stream().filter(r -> r.getResponse().getStatus() == 201).findFirst().orElseThrow();
        MvcResult conflict = results.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst().orElseThrow();
        assertThat((String) read(conflict, "$.detail"))
                .isEqualTo("Idempotency-Key was already used for a different transfer");
        BigDecimal amount = new BigDecimal(read(success, "$.amount").toString());
        assertBalancesAndLedger(from, to, new BigDecimal("100").subtract(amount).toPlainString(), amount.toPlainString());
        assertOneTransferPair(read(success, "$.reference"), from, to, amount);
        assertThat(keyCount(from, key)).isEqualTo(1);
    }

    @Test
    void keyedOppositeTransfersKeepGlobalAccountLockOrder() throws Exception {
        String alice = registerCustomer("Alice Parallel");
        String bob = registerCustomer("Bob Parallel");
        OpenedAccount a = openAccount(alice, "CHECKING", "CAD", "500");
        OpenedAccount b = openAccount(bob, "CHECKING", "CAD", "500");
        List<PendingTransfer> requests = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            requests.add(new PendingTransfer(alice, body(a, b, "10"), UUID.randomUUID().toString()));
            requests.add(new PendingTransfer(bob, body(b, a, "5"), UUID.randomUUID().toString()));
        }

        List<MvcResult> results = overlapAtAccountLock(a.id(), requests);

        for (int i = 0; i < results.size(); i++) {
            MvcResult result = results.get(i);
            assertThat(result.getResponse().getStatus()).isEqualTo(201);
            boolean outgoingFromA = i % 2 == 0;
            assertOneTransferPair(read(result, "$.reference"), outgoingFromA ? a : b,
                    outgoingFromA ? b : a, new BigDecimal(outgoingFromA ? "10" : "5"));
        }
        assertBalancesAndLedger(a, b, "490", "510");
        assertThat(jdbc.queryForObject("select count(*) from transactions where account_id in (?, ?)",
                Long.class, a.id(), b.id())).isEqualTo(10);
    }

    @Test
    void oneUserCannotRaceTheSameKeyAcrossDifferentSourceAccounts() throws Exception {
        String token = registerCustomer("Multiple Source Customer");
        OpenedAccount a = openAccount(token, "CHECKING", "CAD", "100");
        OpenedAccount b = openAccount(token, "CHECKING", "CAD", "100");
        OpenedAccount to = openAccount(token, "SAVINGS", "CAD", null);
        String key = UUID.randomUUID().toString();

        List<MvcResult> results = overlapAtAccountLocks(List.of(a.id(), b.id()), List.of(
                new PendingTransfer(token, body(a, to, "40"), key),
                new PendingTransfer(token, body(b, to, "40"), key)));

        assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList())
                .containsExactlyInAnyOrder(201, 409);
        MvcResult success = results.stream().filter(r -> r.getResponse().getStatus() == 201).findFirst().orElseThrow();
        MvcResult conflict = results.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst().orElseThrow();
        assertThat((String) read(conflict, "$.detail"))
                .isEqualTo("Idempotency-Key was already used for a different transfer");
        long sourceId = ((Number) read(success, "$.fromAccount.id")).longValue();
        assertLedger(a, sourceId == a.id() ? "60" : "100");
        assertLedger(b, sourceId == b.id() ? "60" : "100");
        assertLedger(to, "40");
        assertOneTransferPair(read(success, "$.reference"), sourceId == a.id() ? a : b, to, new BigDecimal("40"));
        assertThat(keyCount(a, key)).isEqualTo(1);
    }

    @Test
    void rejectedTransferRollsBackLedgerAndKeySoAClientCanRetryAfterFunding() throws Exception {
        String token = registerCustomer("Retry Customer");
        OpenedAccount from = openAccount(token, "CHECKING", "CAD", "10");
        OpenedAccount to = openAccount(token, "SAVINGS", "CAD", null);
        String key = UUID.randomUUID().toString();
        PendingTransfer request = new PendingTransfer(token, body(from, to, "40"), key);

        assertThat(send(request).getResponse().getStatus()).isEqualTo(422);
        assertBalancesAndLedger(from, to, "10", "0");
        assertThat(keyCount(from, key)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from transactions where account_id in (?, ?)",
                Long.class, from.id(), to.id())).isEqualTo(1);
        mvc.perform(authed(post("/api/accounts/" + from.id() + "/deposit"), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":100}"))
                .andExpect(status().isOk());
        MvcResult success = send(request);
        assertThat(success.getResponse().getStatus()).isEqualTo(201);
        assertOneTransferPair(read(success, "$.reference"), from, to, new BigDecimal("40"));
        assertBalancesAndLedger(from, to, "70", "40");
        assertThat(keyCount(from, key)).isEqualTo(1);
    }

    @Test
    void duplicateTransferLegIsRejectedAndReplayStillReturnsTheOwnedReceipt() throws Exception {
        String token = registerCustomer("Unique Ledger Customer");
        OpenedAccount from = openAccount(token, "CHECKING", "CAD", "100");
        OpenedAccount to = openAccount(token, "SAVINGS", "CAD", null);
        PendingTransfer request = new PendingTransfer(token, body(from, to, "40"), UUID.randomUUID().toString());
        MvcResult first = send(request);
        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        String reference = read(first, "$.reference");

        assertThatThrownBy(() -> jdbc.update("""
                insert into transactions (account_id, reference, type, amount, balance_after,
                    description, counterparty_account_number, created_at)
                select account_id, reference, type, amount, balance_after,
                    description, counterparty_account_number, created_at
                from transactions where reference = ? and type = 'TRANSFER_OUT'
                """, reference)).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uk_transactions_reference_type");

        MvcResult replay = send(request);
        assertThat(replay.getResponse().getStatus()).isEqualTo(201);
        assertThat((String) read(replay, "$.reference")).isEqualTo(reference);
        assertThat(((Number) read(replay, "$.fromAccount.id")).longValue()).isEqualTo(from.id());
        assertOneTransferPair(reference, from, to, new BigDecimal("40"));
        assertBalancesAndLedger(from, to, "60", "40");
    }

    @Test
    void aCorruptedKeyCannotReplayAnotherCustomersReceipt() throws Exception {
        String alice = registerCustomer("Alice Receipt");
        String bob = registerCustomer("Bob Receipt");
        OpenedAccount a = openAccount(alice, "CHECKING", "CAD", "100");
        OpenedAccount aTo = openAccount(alice, "SAVINGS", "CAD", null);
        OpenedAccount b = openAccount(bob, "CHECKING", "CAD", "100");
        OpenedAccount bTo = openAccount(bob, "SAVINGS", "CAD", null);
        PendingTransfer requestA = new PendingTransfer(alice, body(a, aTo, "40"), UUID.randomUUID().toString());
        PendingTransfer requestB = new PendingTransfer(bob, body(b, bTo, "25"), UUID.randomUUID().toString());
        String referenceA = read(send(requestA), "$.reference");
        String referenceB = read(send(requestB), "$.reference");
        String updateKey = """
                update idempotency_keys set transfer_reference = ?
                where idempotency_key = ? and user_id = (select owner_id from accounts where id = ?)
                """;
        assertThat(jdbc.update(updateKey, referenceB, requestA.key(), a.id())).isEqualTo(1);
        try {
            MvcResult corruptedReplay = send(requestA);
            assertThat(corruptedReplay.getResponse().getStatus()).isEqualTo(500);
            assertThat((String) read(corruptedReplay, "$.detail")).isEqualTo("An unexpected error occurred");
            assertThat(corruptedReplay.getResponse().getContentAsString()).doesNotContain(referenceB, "Bob Receipt");
        } finally {
            jdbc.update(updateKey, referenceA, requestA.key(), a.id());
        }
        MvcResult replay = send(requestA);
        assertThat(replay.getResponse().getStatus()).isEqualTo(201);
        assertThat((String) read(replay, "$.reference")).isEqualTo(referenceA);
        assertBalancesAndLedger(a, aTo, "60", "40");
        assertBalancesAndLedger(b, bTo, "75", "25");
    }

    private MvcResult send(PendingTransfer request) throws Exception {
        return mvc.perform(authed(post("/api/transfers"), request.token())
                        .header("Idempotency-Key", request.key()).contentType(MediaType.APPLICATION_JSON)
                        .content(request.body())).andReturn();
    }

    /** Hold the first account externally until every request is waiting on a database row lock. */
    private List<MvcResult> overlapAtAccountLock(long accountId, List<PendingTransfer> requests) throws Exception {
        return overlapAtAccountLocks(List.of(accountId), requests);
    }

    private List<MvcResult> overlapAtAccountLocks(List<Long> accountIds, List<PendingTransfer> requests) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(requests.size());
        try (Connection holder = dataSource.getConnection()) {
            holder.setAutoCommit(false);
            try (PreparedStatement lock = holder.prepareStatement("select id from accounts where id = ? for update")) {
                for (long accountId : accountIds.stream().sorted().toList()) {
                    lock.setLong(1, accountId);
                    lock.executeQuery().close();
                }
            }
            try {
                CountDownLatch start = new CountDownLatch(1);
                List<Future<MvcResult>> futures = requests.stream().map(request -> pool.submit(() -> {
                    if (!start.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Concurrent request start timed out");
                    }
                    return send(request);
                })).toList();
                start.countDown();
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                int blocked = 0;
                while (System.nanoTime() < deadline) {
                    blocked = jdbc.queryForObject("""
                            select count(*) from pg_stat_activity
                            where datname = current_database() and wait_event_type = 'Lock'
                            and pid <> pg_backend_pid()
                            """, Integer.class);
                    if (blocked == requests.size()) {
                        break;
                    }
                    Thread.sleep(25);
                }
                assertThat(blocked).as("Every request must overlap while holding a database connection")
                        .isEqualTo(requests.size());
                holder.commit();
                List<MvcResult> results = new ArrayList<>();
                for (Future<MvcResult> future : futures) {
                    results.add(future.get(10, TimeUnit.SECONDS));
                }
                return results;
            } finally {
                holder.rollback();
            }
        } finally {
            pool.shutdownNow();
            assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private static String body(OpenedAccount from, OpenedAccount to, String amount) {
        return json("{\"fromAccountId\":%d,\"toAccountNumber\":\"%s\",\"amount\":%s,\"description\":\"Concurrent transfer\"}",
                from.id(), to.number(), amount);
    }

    private long keyCount(OpenedAccount from, String key) {
        return jdbc.queryForObject("""
                select count(*) from idempotency_keys
                where user_id = (select owner_id from accounts where id = ?) and idempotency_key = ?
                """, Long.class, from.id(), key);
    }

    private void assertOneTransferPair(String reference, OpenedAccount from, OpenedAccount to, BigDecimal amount) {
        List<TransferLeg> legs = jdbc.query("select account_id, type, amount from transactions where reference = ?",
                (rs, row) -> new TransferLeg(rs.getLong("account_id"), rs.getString("type"), rs.getBigDecimal("amount")),
                reference);
        assertThat(legs).hasSize(2);
        assertThat(legs.stream().map(TransferLeg::type).toList()).containsExactlyInAnyOrder("TRANSFER_OUT", "TRANSFER_IN");
        for (TransferLeg leg : legs) {
            assertThat(leg.amount()).isEqualByComparingTo(amount);
            assertThat(leg.accountId()).isEqualTo(leg.type().equals("TRANSFER_OUT") ? from.id() : to.id());
        }
    }

    private void assertBalancesAndLedger(OpenedAccount from, OpenedAccount to, String fromBalance, String toBalance) {
        assertLedger(from, fromBalance);
        assertLedger(to, toBalance);
    }

    private void assertLedger(OpenedAccount account, String expectedBalance) {
        BigDecimal balance = jdbc.queryForObject("select balance from accounts where id = ?", BigDecimal.class, account.id());
        assertThat(balance).isEqualByComparingTo(expectedBalance).isNotNegative();
        List<LedgerEntry> entries = jdbc.query("""
                select type, amount, balance_after from transactions where account_id = ? order by id
                """, (rs, row) -> new LedgerEntry(TransactionType.valueOf(rs.getString("type")),
                rs.getBigDecimal("amount"), rs.getBigDecimal("balance_after")), account.id());
        BigDecimal running = BigDecimal.ZERO;
        for (LedgerEntry entry : entries) {
            running = entry.type().isCredit() ? running.add(entry.amount()) : running.subtract(entry.amount());
            assertThat(entry.balanceAfter()).isEqualByComparingTo(running).isNotNegative();
        }
        assertThat(running).isEqualByComparingTo(balance);
    }

    private record PendingTransfer(String token, String body, String key) {}
    private record TransferLeg(long accountId, String type, BigDecimal amount) {}
    private record LedgerEntry(TransactionType type, BigDecimal amount, BigDecimal balanceAfter) {}
}
