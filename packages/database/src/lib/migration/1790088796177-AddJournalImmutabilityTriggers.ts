import { MigrationInterface, QueryRunner } from 'typeorm';

// CLAUDE.md rule 2: journal_entry/journal_line are append-only. Up to now
// that was enforced only by convention (LedgerService.postEntry() being
// the sole write path) — nothing stopped a stray UPDATE or soft-delete
// from mutating ledger history in the DB. These triggers make it a hard
// error at the schema level, the same way the debit/credit CHECK
// constraint backstops the balance invariant.
export class AddJournalImmutabilityTriggers1790088796177 implements MigrationInterface {
    name = 'AddJournalImmutabilityTriggers1790088796177';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION prevent_journal_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'journal entries are append-only: % on % is not permitted', TG_OP, TG_TABLE_NAME;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await queryRunner.query(`
            CREATE TRIGGER journal_entry_no_update_delete
            BEFORE UPDATE OR DELETE ON "journal_entry"
            FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();
        `);

        await queryRunner.query(`
            CREATE TRIGGER journal_line_no_update_delete
            BEFORE UPDATE OR DELETE ON "journal_line"
            FOR EACH ROW EXECUTE FUNCTION prevent_journal_mutation();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS journal_line_no_update_delete ON "journal_line"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS journal_entry_no_update_delete ON "journal_entry"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_journal_mutation()`);
    }
}
