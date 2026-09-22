import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProcessedWebhookEvent1790088265094 implements MigrationInterface {
    name = 'CreateProcessedWebhookEvent1790088265094'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."processed_webhook_event_provider_enum" AS ENUM('cashfree', 'stripe')`);
        await queryRunner.query(`CREATE TABLE "processed_webhook_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "provider" "public"."processed_webhook_event_provider_enum" NOT NULL, "event_id" text NOT NULL, "event_type" text NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_4b7dad60a86bcf14da563f5e274" UNIQUE ("provider", "event_id"), CONSTRAINT "PK_449171f95f7e4e792445855f3bf" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "processed_webhook_event"`);
        await queryRunner.query(`DROP TYPE "public"."processed_webhook_event_provider_enum"`);
    }

}
