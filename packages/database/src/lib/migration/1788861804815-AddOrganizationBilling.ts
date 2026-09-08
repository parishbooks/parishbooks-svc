import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationBilling1788861804815 implements MigrationInterface {
    name = 'AddOrganizationBilling1788861804815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_billing_status_enum" AS ENUM('active', 'pastDue', 'locked', 'canceled')`);
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "billing_status" "public"."organization_profile_billing_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_billing_provider_enum" AS ENUM('stripe', 'cashfree')`);
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "billing_provider" "public"."organization_profile_billing_provider_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "billing_provider"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_billing_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "billing_status"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_billing_status_enum"`);
    }

}
