package com.eqbank.accountserv.service;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Upgrade actual V1 data on H2 by default and on PostgreSQL in the dedicated CI jobs. */
class ReferenceMigrationTest {

    private final String schema = "migration_" + UUID.randomUUID().toString().replace("-", "");
    private DriverManagerDataSource dataSource;
    private JdbcTemplate jdbc;

    @BeforeEach
    void createLegacySchema() throws Exception {
        boolean postgres = "true".equals(System.getenv("BANKING_POSTGRES_TESTS"));
        String url = postgres ? Objects.requireNonNull(System.getenv("SPRING_DATASOURCE_URL"))
                : "jdbc:h2:mem:" + schema + ";DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE";
        dataSource = new DriverManagerDataSource(url,
                postgres ? System.getenv("SPRING_DATASOURCE_USERNAME") : "sa",
                postgres ? Objects.requireNonNullElse(System.getenv("SPRING_DATASOURCE_PASSWORD"), "") : "");
        jdbc = new JdbcTemplate(dataSource);
        if (postgres) {
            try (var connection = dataSource.getConnection()) {
                assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            }
        }
        migration("1").migrate();
        jdbc.update("insert into " + table("users") + """
                (id, email, password_hash, full_name, role, created_at)
                values (1, 'legacy@example.com', 'unused', 'Legacy Customer', 'CUSTOMER', current_timestamp)
                """);
        for (int id = 1; id <= 3; id++) {
            jdbc.update("insert into " + table("accounts") + """
                    (id, account_number, owner_id, type, currency, balance, status, interest_rate,
                     daily_withdrawal_limit, created_at, updated_at)
                    values (?, ?, 1, 'CHECKING', ?, 100, 'ACTIVE', 0, 1000, current_timestamp, current_timestamp)
                    """, id, "00000000000" + id, id == 3 ? "USD" : "CAD");
        }
    }

    @AfterEach
    void dropOnlyFixtureSchema() {
        if (jdbc != null) {
            jdbc.execute("drop schema if exists \"" + schema + "\" cascade");
        }
    }

    @Test
    void validLegacyReferencesAndKeysSurviveUpgradeAndFullReferencesFit() {
        addLeg("TX-OLDDEPOSIT", "DEPOSIT", "100", 1);
        addLeg("TX-OLDTRANSFER", "TRANSFER_OUT", "25", 1);
        addLeg("TX-OLDTRANSFER", "TRANSFER_IN", "25", 2);
        addKey("TX-OLDTRANSFER");
        jdbc.update("update " + table("transactions")
                + " set balance_after = case type when 'DEPOSIT' then 100 when 'TRANSFER_OUT' then 75 else 25 end");
        jdbc.update("update " + table("accounts")
                + " set balance = case id when 1 then 75 when 2 then 25 else 0 end");
        List<Map<String, Object>> history = ledgerRows();
        List<Map<String, Object>> keys = keyRows();
        List<Map<String, Object>> accounts = jdbc.queryForList("select * from " + table("accounts") + " order by id");

        migration("2").migrate();

        assertThat(ledgerRows()).isEqualTo(history);
        assertThat(keyRows()).isEqualTo(keys);
        assertThat(jdbc.queryForList("select * from " + table("accounts") + " order by id")).isEqualTo(accounts);
        assertThat(width("transactions", "reference")).isEqualTo(40);
        assertThat(width("idempotency_keys", "transfer_reference")).isEqualTo(40);
        String fullReference = References.newReference();
        addLeg(fullReference, "DEPOSIT", "1", 1);
        addKey(fullReference);
        assertThat(jdbc.queryForObject("select count(*) from " + table("transactions")
                + " where reference = ?", Integer.class, fullReference)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from " + table("idempotency_keys")
                + " where transfer_reference = ?", Integer.class, fullReference)).isEqualTo(1);
    }

    @ParameterizedTest
    @CsvSource({
            "DEPOSIT, WITHDRAWAL, 25, 25, 1, 2",
            "TRANSFER_OUT, TRANSFER_OUT, 25, 25, 1, 2",
            "TRANSFER_OUT, TRANSFER_IN, 25, 26, 1, 2",
            "TRANSFER_OUT, TRANSFER_IN, 25, 25, 1, 3",
            "TRANSFER_OUT, TRANSFER_IN, 25, 25, 1, 1"
    })
    void ambiguousHistoryRejectsUpgradeBeforeAnyLedgerOrSchemaChange(
            String firstType, String secondType, String firstAmount, String secondAmount,
            int firstAccount, int secondAccount) {
        addLeg("TX-COLLISION", firstType, firstAmount, firstAccount);
        addLeg("TX-COLLISION", secondType, secondAmount, secondAccount);
        addKey("TX-COLLISION");
        assertRejectedWithoutChanges();
    }

    @ParameterizedTest
    @ValueSource(strings = {"TRANSFER_OUT", "TRANSFER_IN"})
    void aTransferWithoutItsOtherLegRejectsUpgrade(String type) {
        addLeg("TX-COLLISION", type, "25", 1);
        addKey("TX-COLLISION");
        assertRejectedWithoutChanges();
    }

    @Test
    void twoOtherwiseValidTransfersSharingOneShortReferenceRejectUpgrade() {
        addLeg("TX-COLLISION", "TRANSFER_OUT", "25", 1);
        addLeg("TX-COLLISION", "TRANSFER_IN", "25", 2);
        addLeg("TX-COLLISION", "TRANSFER_OUT", "30", 1);
        addLeg("TX-COLLISION", "TRANSFER_IN", "30", 2);
        addKey("TX-COLLISION");
        addKey("TX-COLLISION");
        assertRejectedWithoutChanges();
    }

    private void assertRejectedWithoutChanges() {
        List<Map<String, Object>> history = ledgerRows();
        List<Map<String, Object>> keys = keyRows();

        assertThatThrownBy(() -> migration("2").migrate()).isInstanceOf(FlywayException.class)
                .hasStackTraceContaining("Ambiguous legacy ledger reference: TX-COLLISION")
                .hasStackTraceContaining("no ledger rows were changed");

        assertThat(ledgerRows()).isEqualTo(history);
        assertThat(keyRows()).isEqualTo(keys);
        assertThat(width("transactions", "reference")).isEqualTo(20);
        assertThat(width("idempotency_keys", "transfer_reference")).isEqualTo(20);
        assertThat(jdbc.queryForObject("""
                select count(*) from information_schema.table_constraints
                where table_schema = ? and table_name = 'transactions'
                and lower(constraint_name) = 'uk_transactions_reference_type'
                """, Integer.class, schema)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from " + table("flyway_schema_history")
                + " where version = '2' and success = true", Integer.class)).isZero();
    }

    private Flyway migration(String target) {
        return Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target(target).load();
    }

    private String table(String name) {
        return "\"" + schema + "\"." + name;
    }

    private void addLeg(String reference, String type, String amount, int accountId) {
        jdbc.update("insert into " + table("transactions") + """
                (account_id, reference, type, amount, balance_after, description, created_at)
                values (?, ?, ?, cast(? as decimal(19, 2)), 75, 'Legacy receipt', current_timestamp)
                """, accountId, reference, type, amount);
    }

    private void addKey(String reference) {
        jdbc.update("insert into " + table("idempotency_keys") + """
                (idempotency_key, user_id, request_hash, transfer_reference, created_at)
                values (?, 1, ?, ?, current_timestamp)
                """, UUID.randomUUID().toString(), "0".repeat(64), reference);
    }

    private List<Map<String, Object>> ledgerRows() {
        return jdbc.queryForList("select * from " + table("transactions") + " order by id");
    }

    private List<Map<String, Object>> keyRows() {
        return jdbc.queryForList("select * from " + table("idempotency_keys") + " order by id");
    }

    private int width(String tableName, String columnName) {
        return jdbc.queryForObject("""
                select character_maximum_length from information_schema.columns
                where table_schema = ? and table_name = ? and column_name = ?
                """, Integer.class, schema, tableName, columnName);
    }
}
