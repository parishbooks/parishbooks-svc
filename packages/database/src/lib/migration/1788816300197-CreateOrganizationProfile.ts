import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizationProfile1788816300197 implements MigrationInterface {
    name = 'CreateOrganizationProfile1788816300197'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_country_enum" AS ENUM('IN', 'US')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_plantier_enum" AS ENUM('starter', 'pro')`);
        await queryRunner.query(`CREATE TYPE "public"."organization_profile_currency_enum" AS ENUM('INR', 'USD')`);
        await queryRunner.query(`CREATE TABLE "organization_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "organizationId" uuid NOT NULL, "country" "public"."organization_profile_country_enum" NOT NULL DEFAULT 'IN', "fcraRegistered" boolean NOT NULL DEFAULT false, "planTier" "public"."organization_profile_plantier_enum" NOT NULL DEFAULT 'starter', "timezone" text NOT NULL, "currency" "public"."organization_profile_currency_enum" NOT NULL DEFAULT 'INR', "registrationNumber" text, "taxExemptionNumber80g" text, "ein" text, CONSTRAINT "UQ_73c3c1ad47d63dbf79b7ae73cd9" UNIQUE ("organizationId"), CONSTRAINT "PK_a459f7af77cb9a0fd82286f661a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "organization_profile"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_plantier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organization_profile_country_enum"`);
    }

}
