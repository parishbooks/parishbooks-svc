import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDonation1790088214542 implements MigrationInterface {
    name = 'CreateDonation1790088214542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."donation_currency_enum" AS ENUM('INR', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."donation_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TYPE "public"."donation_payment_provider_enum" AS ENUM('cashfree')`);
        await queryRunner.query(`CREATE TABLE "donation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "member_id" uuid, "fund_id" uuid NOT NULL, "account_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" "public"."donation_currency_enum" NOT NULL, "status" "public"."donation_status_enum" NOT NULL DEFAULT 'pending', "idempotency_key" text NOT NULL, "payment_provider" "public"."donation_payment_provider_enum" NOT NULL, "cashfree_order_id" text, "provider_payment_id" text, "pan_number" text, "journal_entry_id" uuid, "failure_reason" text, "donated_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_56b61328fa3651050504d86517f" UNIQUE ("provider_payment_id"), CONSTRAINT "UQ_ea6fd78496e894aa1335ecb4814" UNIQUE ("organization_id", "idempotency_key"), CONSTRAINT "PK_25fb5a541964bc5cfc18fb13a82" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3bb690b21bc78d3bb00313c20a" ON "donation"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d77c281a8cd3a458f8adcb6b6" ON "donation"  ("organization_id", "fund_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c171e9b134b0006792a8be1a2e" ON "donation"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c171e9b134b0006792a8be1a2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d77c281a8cd3a458f8adcb6b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bb690b21bc78d3bb00313c20a"`);
        await queryRunner.query(`DROP TABLE "donation"`);
        await queryRunner.query(`DROP TYPE "public"."donation_payment_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."donation_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."donation_currency_enum"`);
    }

}
