import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFamilyAndMember1790088109938 implements MigrationInterface {
    name = 'CreateFamilyAndMember1790088109938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "family_id" uuid, "first_name" text NOT NULL, "last_name" text NOT NULL, "email" text, "phone" text, "pan_number" text, "better_auth_user_id" uuid, CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bfadaaab56ae7b5f2d76885d03" ON "member"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1f2ca14ab2bd3b240423645eb" ON "member"  ("organization_id", "id") `);
        await queryRunner.query(`CREATE TABLE "family" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "name" text NOT NULL, "address" jsonb, CONSTRAINT "PK_ba386a5a59c3de8593cda4e5626" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6951f7dd0607da32e4bca98885" ON "family"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8d79d9725adf4f86e4713fbc7e" ON "family"  ("organization_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8d79d9725adf4f86e4713fbc7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6951f7dd0607da32e4bca98885"`);
        await queryRunner.query(`DROP TABLE "family"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1f2ca14ab2bd3b240423645eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bfadaaab56ae7b5f2d76885d03"`);
        await queryRunner.query(`DROP TABLE "member"`);
    }

}
