package db.migration;

import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Preserve legacy receipts, but stop before changing schema if references are ambiguous. */
public class V2__unique_ledger_references extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        try (var statement = context.getConnection().createStatement()) {
            try (var conflicts = statement.executeQuery("""
                    select t.reference from transactions t join accounts a on a.id = t.account_id
                    group by t.reference
                    having not (
                        (count(*) = 1 and min(t.type) in ('DEPOSIT', 'WITHDRAWAL', 'INTEREST'))
                        or (
                        count(*) = 2
                        and sum(case when t.type = 'TRANSFER_OUT' then 1 else 0 end) = 1
                        and sum(case when t.type = 'TRANSFER_IN' then 1 else 0 end) = 1
                        and min(t.amount) = max(t.amount)
                        and min(a.currency) = max(a.currency)
                        and count(distinct t.account_id) = 2))
                    order by t.reference
                    """)) {
                if (conflicts.next()) {
                    throw new FlywayException("Ambiguous legacy ledger reference: " + conflicts.getString(1)
                            + ". Reconcile this history explicitly before retrying; no ledger rows were changed.");
                }
            }
            statement.execute("alter table transactions add constraint uk_transactions_reference_type unique (reference, type)");
            statement.execute("alter table transactions alter column reference set data type varchar(40)");
            statement.execute("alter table idempotency_keys alter column transfer_reference set data type varchar(40)");
        }
    }
}
