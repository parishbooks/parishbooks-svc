import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCashfreeVendorFieldsToOrganizationProfile1790088080236 implements MigrationInterface {
    name = 'AddCashfreeVendorFieldsToOrganizationProfile1790088080236'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "cashfree_vendor_id" text`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_cashfree_vendor_status_enum" AS ENUM('not_started', 'pending', 'active', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "cashfree_vendor_status" "public"."organization_profile_cashfree_vendor_status_enum" NOT NULL DEFAULT 'not_started'`);
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "cashfree_vendor_status_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "cashfree_vendor_status_at"`);
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "cashfree_vendor_status"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_cashfree_vendor_status_enum"`);
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "cashfree_vendor_id"`);
    }

}
