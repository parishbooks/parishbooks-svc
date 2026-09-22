import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashfreeVendorRejectionReasonToOrganizationProfile1790089200000 implements MigrationInterface {
    name = 'AddCashfreeVendorRejectionReasonToOrganizationProfile1790089200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organization_profile" ADD "cashfree_vendor_rejection_reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organization_profile" DROP COLUMN "cashfree_vendor_rejection_reason"`);
    }
}
