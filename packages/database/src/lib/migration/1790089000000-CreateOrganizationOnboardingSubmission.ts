import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationOnboardingSubmission1790089000000 implements MigrationInterface {
    name = 'CreateOrganizationOnboardingSubmission1790089000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "organization_onboarding_submission" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid NOT NULL,
                "business_name" text NOT NULL,
                "pan_number_masked" text NOT NULL,
                "bank_account_masked" text NOT NULL,
                "ifsc" text NOT NULL,
                "gstin" text,
                "submitted_by_user_id" uuid NOT NULL,
                "provider_raw_status" text,
                CONSTRAINT "PK_organization_onboarding_submission" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_org_onboarding_submission_org_id_id" ON "organization_onboarding_submission" ("organization_id", "id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_org_onboarding_submission_org_id_id"`);
        await queryRunner.query(`DROP TABLE "organization_onboarding_submission"`);
    }
}
