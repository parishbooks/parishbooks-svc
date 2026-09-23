import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790134761769 implements MigrationInterface {
    name = 'Init1790134761769'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."account_type_enum" AS ENUM('asset', 'liability', 'equity', 'income', 'expense')`);
        await queryRunner.query(`CREATE TABLE "account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "code" text NOT NULL, "name" text NOT NULL, "type" "public"."account_type_enum" NOT NULL, "parent_account_id" uuid, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_b6cd18f8dc7ff8d254ec38c9eb1" UNIQUE ("organization_id", "code"), CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_020686089902f4a0b53aa74019" ON "account"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_300c64cce0bff188a7bc18bab5" ON "account"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TYPE "public"."donation_currency_enum" AS ENUM('INR', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."donation_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TYPE "public"."donation_payment_provider_enum" AS ENUM('cashfree')`);
        await queryRunner.query(`CREATE TABLE "donation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "member_id" uuid, "fund_id" uuid NOT NULL, "account_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" "public"."donation_currency_enum" NOT NULL, "status" "public"."donation_status_enum" NOT NULL DEFAULT 'pending', "idempotency_key" text NOT NULL, "payment_provider" "public"."donation_payment_provider_enum" NOT NULL, "cashfree_order_id" text, "provider_payment_id" text, "pan_number" text, "journal_entry_id" uuid, "failure_reason" text, "donated_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_25fb5a541964bc5cfc18fb13a82" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3bb690b21bc78d3bb00313c20a" ON "donation"  ("organization_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_68d04a5ec14354226820093a69" ON "donation"  ("provider_payment_id") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f8d3266f7edacdcf8b83307812" ON "donation"  ("organization_id", "idempotency_key") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_7d77c281a8cd3a458f8adcb6b6" ON "donation"  ("organization_id", "fund_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c171e9b134b0006792a8be1a2e" ON "donation"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "family" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "name" text NOT NULL, "address" jsonb, CONSTRAINT "PK_ba386a5a59c3de8593cda4e5626" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6951f7dd0607da32e4bca98885" ON "family"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8d79d9725adf4f86e4713fbc7e" ON "family"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TYPE "public"."fund_type_enum" AS ENUM('general', 'restricted', 'building', 'mission')`);
        await queryRunner.query(`CREATE TABLE "fund" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "name" text NOT NULL, "type" "public"."fund_type_enum" NOT NULL, "fcra_flag" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_b3ac6e413e6e449bb499db1ccbc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_30bbfaf6f1ccec5591ec3da1e3" ON "fund"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_25ca8597b04383ac0ba8421785" ON "fund"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TYPE "public"."journal_entry_source_type_enum" AS ENUM('donation', 'manual', 'payroll', 'adjustment', 'reversal')`);
        await queryRunner.query(`CREATE TABLE "journal_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "date" date NOT NULL, "description" text NOT NULL, "source_type" "public"."journal_entry_source_type_enum" NOT NULL, "source_id" uuid, "reversal_of_entry_id" uuid, "created_by" uuid NOT NULL, CONSTRAINT "PK_69167f660c807d2aa178f0bd7e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ff92eb936fa40fd2294bc8c912" ON "journal_entry"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e05cbd8fac5392631b404090c" ON "journal_entry"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "journal_line" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "debit" numeric(12,2) NOT NULL DEFAULT '0', "credit" numeric(12,2) NOT NULL DEFAULT '0', "memo" text, CONSTRAINT "CHK_773a097c65d9d04839bf295297" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)), CONSTRAINT "PK_4158ea7f291d9234ae64221898a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3c6468b90ee269cbda3ede5667" ON "journal_line"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc3dc994ceec0f4a3b3b581191" ON "journal_line"  ("organization_id", "journal_entry_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_325509f0d9b6a5060b864e18b3" ON "journal_line"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "family_id" uuid, "first_name" text NOT NULL, "last_name" text NOT NULL, "email" text, "phone" text, "pan_number" text, "better_auth_user_id" uuid, CONSTRAINT "UQ_35bc7e9f996e1070adb1a326596" UNIQUE ("organization_id", "better_auth_user_id"), CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bfadaaab56ae7b5f2d76885d03" ON "member"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1f2ca14ab2bd3b240423645eb" ON "member"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "organization_onboarding_submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "business_name" text NOT NULL, "pan_number_masked" text NOT NULL, "bank_account_masked" text NOT NULL, "ifsc" text NOT NULL, "gstin" text, "submitted_by_user_id" uuid NOT NULL, "provider_raw_status" text, CONSTRAINT "PK_308a0c821af6e8a096a64ae76c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b991f0882361d5ea7bd7cb9657" ON "organization_onboarding_submission"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d14a2eb3f0371c12a53722f4d6" ON "organization_onboarding_submission"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_country_enum" AS ENUM('IN', 'US')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_plan_tier_enum" AS ENUM('starter', 'pro')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_billing_status_enum" AS ENUM('active', 'pastDue', 'locked', 'canceled')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_billing_provider_enum" AS ENUM('stripe', 'cashfree')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_currency_enum" AS ENUM('INR', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_cashfree_vendor_status_enum" AS ENUM('not_started', 'pending', 'active', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "organization_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "country" "public"."organization_profile_country_enum" NOT NULL DEFAULT 'IN', "fcra_registered" boolean NOT NULL DEFAULT false, "plan_tier" "public"."organization_profile_plan_tier_enum" NOT NULL DEFAULT 'starter', "billing_status" "public"."organization_profile_billing_status_enum" NOT NULL DEFAULT 'active', "billing_provider" "public"."organization_profile_billing_provider_enum", "timezone" text NOT NULL, "currency" "public"."organization_profile_currency_enum" NOT NULL DEFAULT 'INR', "registration_number" text, "tax_exemption_number80g" text, "ein" text, "cashfree_vendor_id" text, "cashfree_vendor_status" "public"."organization_profile_cashfree_vendor_status_enum" NOT NULL DEFAULT 'not_started', "cashfree_vendor_status_at" TIMESTAMP WITH TIME ZONE, "cashfree_vendor_rejection_reason" text, CONSTRAINT "UQ_db65c4ae2d07b920efb5d9d5cbe" UNIQUE ("organization_id"), CONSTRAINT "PK_a459f7af77cb9a0fd82286f661a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."processed_webhook_event_provider_enum" AS ENUM('cashfree', 'stripe')`);
        await queryRunner.query(`CREATE TABLE "processed_webhook_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "provider" "public"."processed_webhook_event_provider_enum" NOT NULL, "event_id" text NOT NULL, "event_type" text NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_4b7dad60a86bcf14da563f5e274" UNIQUE ("provider", "event_id"), CONSTRAINT "PK_449171f95f7e4e792445855f3bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "receipt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "donation_id" uuid NOT NULL, "financial_year" text NOT NULL, "receipt_number" text NOT NULL, "fund_fcra_snapshot" boolean NOT NULL, "pdf_url" text, "qr_verification_token" text NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_7e45491b4511922ec3a6732a4fa" UNIQUE ("qr_verification_token"), CONSTRAINT "UQ_9a9fec9ccc46bde2fa289ef2896" UNIQUE ("organization_id", "financial_year", "receipt_number"), CONSTRAINT "UQ_36c8f3825bbc68cb00c26d79ea0" UNIQUE ("donation_id"), CONSTRAINT "PK_b4b9ec7d164235fbba023da9832" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9f0c1be5c2a40dffff425866fe" ON "receipt"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20618e793f28e047edcf7101d4" ON "receipt"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_20618e793f28e047edcf7101d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f0c1be5c2a40dffff425866fe"`);
        await queryRunner.query(`DROP TABLE "receipt"`);
        await queryRunner.query(`DROP TABLE "processed_webhook_event"`);
        await queryRunner.query(`DROP TYPE "public"."processed_webhook_event_provider_enum"`);
        await queryRunner.query(`DROP TABLE "organization_profile"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_cashfree_vendor_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_billing_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_billing_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_plan_tier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_country_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d14a2eb3f0371c12a53722f4d6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b991f0882361d5ea7bd7cb9657"`);
        await queryRunner.query(`DROP TABLE "organization_onboarding_submission"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1f2ca14ab2bd3b240423645eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bfadaaab56ae7b5f2d76885d03"`);
        await queryRunner.query(`DROP TABLE "member"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_325509f0d9b6a5060b864e18b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc3dc994ceec0f4a3b3b581191"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3c6468b90ee269cbda3ede5667"`);
        await queryRunner.query(`DROP TABLE "journal_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e05cbd8fac5392631b404090c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff92eb936fa40fd2294bc8c912"`);
        await queryRunner.query(`DROP TABLE "journal_entry"`);
        await queryRunner.query(`DROP TYPE "public"."journal_entry_source_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25ca8597b04383ac0ba8421785"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30bbfaf6f1ccec5591ec3da1e3"`);
        await queryRunner.query(`DROP TABLE "fund"`);
        await queryRunner.query(`DROP TYPE "public"."fund_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d79d9725adf4f86e4713fbc7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6951f7dd0607da32e4bca98885"`);
        await queryRunner.query(`DROP TABLE "family"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c171e9b134b0006792a8be1a2e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d77c281a8cd3a458f8adcb6b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8d3266f7edacdcf8b83307812"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68d04a5ec14354226820093a69"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bb690b21bc78d3bb00313c20a"`);
        await queryRunner.query(`DROP TABLE "donation"`);
        await queryRunner.query(`DROP TYPE "public"."donation_payment_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."donation_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."donation_currency_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_300c64cce0bff188a7bc18bab5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_020686089902f4a0b53aa74019"`);
        await queryRunner.query(`DROP TABLE "account"`);
        await queryRunner.query(`DROP TYPE "public"."account_type_enum"`);
    }

}
