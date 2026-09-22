import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReceipt1790088238075 implements MigrationInterface {
    name = 'CreateReceipt1790088238075'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "receipt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "donation_id" uuid NOT NULL, "receipt_number" text NOT NULL, "fund_fcra_snapshot" boolean NOT NULL, "pdf_url" text, "qr_verification_token" text NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_7e45491b4511922ec3a6732a4fa" UNIQUE ("qr_verification_token"), CONSTRAINT "UQ_36c8f3825bbc68cb00c26d79ea0" UNIQUE ("donation_id"), CONSTRAINT "PK_b4b9ec7d164235fbba023da9832" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9f0c1be5c2a40dffff425866fe" ON "receipt"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20618e793f28e047edcf7101d4" ON "receipt"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_20618e793f28e047edcf7101d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f0c1be5c2a40dffff425866fe"`);
        await queryRunner.query(`DROP TABLE "receipt"`);
    }

}
