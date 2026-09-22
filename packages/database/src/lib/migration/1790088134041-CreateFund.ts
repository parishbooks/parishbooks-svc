import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFund1790088134041 implements MigrationInterface {
    name = 'CreateFund1790088134041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."fund_type_enum" AS ENUM('general', 'restricted', 'building', 'mission')`);
        await queryRunner.query(`CREATE TABLE "fund" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "name" text NOT NULL, "type" "public"."fund_type_enum" NOT NULL, "fcra_flag" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_b3ac6e413e6e449bb499db1ccbc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_30bbfaf6f1ccec5591ec3da1e3" ON "fund"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_25ca8597b04383ac0ba8421785" ON "fund"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_25ca8597b04383ac0ba8421785"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30bbfaf6f1ccec5591ec3da1e3"`);
        await queryRunner.query(`DROP TABLE "fund"`);
        await queryRunner.query(`DROP TYPE "public"."fund_type_enum"`);
    }

}
