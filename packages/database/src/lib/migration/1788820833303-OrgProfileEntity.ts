import { MigrationInterface, QueryRunner } from "typeorm";

export class OrgProfileEntity1788820833303 implements MigrationInterface {
    name = 'OrgProfileEntity1788820833303'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_country_enum" AS ENUM('IN', 'US')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_plan_tier_enum" AS ENUM('starter', 'pro')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_currency_enum" AS ENUM('INR', 'USD')`);
        await queryRunner.query(`CREATE TABLE "organization_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "organization_id" uuid NOT NULL, "country" "public"."organization_profile_country_enum" NOT NULL DEFAULT 'IN', "fcra_registered" boolean NOT NULL DEFAULT false, "plan_tier" "public"."organization_profile_plan_tier_enum" NOT NULL DEFAULT 'starter', "timezone" text NOT NULL, "currency" "public"."organization_profile_currency_enum" NOT NULL DEFAULT 'INR', "registration_number" text, "tax_exemption_number80g" text, "ein" text, CONSTRAINT "UQ_db65c4ae2d07b920efb5d9d5cbe" UNIQUE ("organization_id"), CONSTRAINT "PK_a459f7af77cb9a0fd82286f661a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "organization_profile"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_plan_tier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_country_enum"`);
    }

}
