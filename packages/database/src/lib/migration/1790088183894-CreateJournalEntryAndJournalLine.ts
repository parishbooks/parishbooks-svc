import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJournalEntryAndJournalLine1790088183894 implements MigrationInterface {
    name = 'CreateJournalEntryAndJournalLine1790088183894'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."journal_entry_source_type_enum" AS ENUM('donation', 'manual', 'payroll', 'adjustment', 'reversal')`);
        await queryRunner.query(`CREATE TABLE "journal_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "date" date NOT NULL, "description" text NOT NULL, "source_type" "public"."journal_entry_source_type_enum" NOT NULL, "source_id" uuid, "reversal_of_entry_id" uuid, "created_by" uuid NOT NULL, CONSTRAINT "PK_69167f660c807d2aa178f0bd7e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ff92eb936fa40fd2294bc8c912" ON "journal_entry"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e05cbd8fac5392631b404090c" ON "journal_entry"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "journal_line" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "debit" numeric(12,2) NOT NULL DEFAULT '0', "credit" numeric(12,2) NOT NULL DEFAULT '0', "memo" text, CONSTRAINT "CHK_773a097c65d9d04839bf295297" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)), CONSTRAINT "PK_4158ea7f291d9234ae64221898a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3c6468b90ee269cbda3ede5667" ON "journal_line"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc3dc994ceec0f4a3b3b581191" ON "journal_line"  ("organization_id", "journal_entry_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_325509f0d9b6a5060b864e18b3" ON "journal_line"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_325509f0d9b6a5060b864e18b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc3dc994ceec0f4a3b3b581191"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3c6468b90ee269cbda3ede5667"`);
        await queryRunner.query(`DROP TABLE "journal_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e05cbd8fac5392631b404090c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff92eb936fa40fd2294bc8c912"`);
        await queryRunner.query(`DROP TABLE "journal_entry"`);
        await queryRunner.query(`DROP TYPE "public"."journal_entry_source_type_enum"`);
    }

}
