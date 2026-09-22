import { MigrationInterface, QueryRunner } from "typeorm";

// Code-review fixes (see docs/architecture/phase1-giving-ledger-schema-design.md):
// - Donation: idempotencyKey/providerPaymentId uniqueness moved to partial
//   indexes scoped to deleted_at IS NULL, so a soft-deleted row never
//   permanently blocks a legitimate retry.
// - Receipt: added a stored financialYear column and a
//   (organizationId, financialYear, receiptNumber) unique constraint, so
//   concurrent receipt issuance can't produce duplicate receipt numbers.
// - Member: added a (organizationId, betterAuthUserId) unique constraint
//   (NULLs unaffected) to stop one congregant getting two Member rows.
export class FixDonationReceiptMemberConstraintGaps1790088761537 implements MigrationInterface {
    name = 'FixDonationReceiptMemberConstraintGaps1790088761537'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donation" DROP CONSTRAINT "UQ_ea6fd78496e894aa1335ecb4814"`);
        await queryRunner.query(`ALTER TABLE "receipt" ADD "financial_year" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "donation" DROP CONSTRAINT "UQ_56b61328fa3651050504d86517f"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_68d04a5ec14354226820093a69" ON "donation"  ("provider_payment_id") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f8d3266f7edacdcf8b83307812" ON "donation"  ("organization_id", "idempotency_key") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`ALTER TABLE "member" ADD CONSTRAINT "UQ_35bc7e9f996e1070adb1a326596" UNIQUE ("organization_id", "better_auth_user_id")`);
        await queryRunner.query(`ALTER TABLE "receipt" ADD CONSTRAINT "UQ_9a9fec9ccc46bde2fa289ef2896" UNIQUE ("organization_id", "financial_year", "receipt_number")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "receipt" DROP CONSTRAINT "UQ_9a9fec9ccc46bde2fa289ef2896"`);
        await queryRunner.query(`ALTER TABLE "member" DROP CONSTRAINT "UQ_35bc7e9f996e1070adb1a326596"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8d3266f7edacdcf8b83307812"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68d04a5ec14354226820093a69"`);
        await queryRunner.query(`ALTER TABLE "donation" ADD CONSTRAINT "UQ_56b61328fa3651050504d86517f" UNIQUE ("provider_payment_id")`);
        await queryRunner.query(`ALTER TABLE "receipt" DROP COLUMN "financial_year"`);
        await queryRunner.query(`ALTER TABLE "donation" ADD CONSTRAINT "UQ_ea6fd78496e894aa1335ecb4814" UNIQUE ("organization_id", "idempotency_key")`);
    }

}
