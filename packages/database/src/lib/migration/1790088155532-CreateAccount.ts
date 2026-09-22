import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccount1790088155532 implements MigrationInterface {
    name = 'CreateAccount1790088155532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."account_type_enum" AS ENUM('asset', 'liability', 'equity', 'income', 'expense')`);
        await queryRunner.query(`CREATE TABLE "account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "code" text NOT NULL, "name" text NOT NULL, "type" "public"."account_type_enum" NOT NULL, "parent_account_id" uuid, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_b6cd18f8dc7ff8d254ec38c9eb1" UNIQUE ("organization_id", "code"), CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_020686089902f4a0b53aa74019" ON "account"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_300c64cce0bff188a7bc18bab5" ON "account"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_300c64cce0bff188a7bc18bab5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_020686089902f4a0b53aa74019"`);
        await queryRunner.query(`DROP TABLE "account"`);
        await queryRunner.query(`DROP TYPE "public"."account_type_enum"`);
    }

}
