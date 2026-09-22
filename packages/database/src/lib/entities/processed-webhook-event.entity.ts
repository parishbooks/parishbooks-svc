import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum WebhookProvider {
    CASHFREE = 'cashfree',
    STRIPE = 'stripe',
}

// Deliberately NOT a TenantEntity: dedupe must work before any tenant
// context is established from the (still-untrusted, pre-signature-check)
// payload — see docs/integrations/cashfree-giving-split.md §3 and CLAUDE.md
// rule 5. This is the single documented exception to CLAUDE.md rule 1.
@Entity('processed_webhook_event')
@Unique(['provider', 'eventId'])
export class ProcessedWebhookEvent extends BaseEntity {
    @Column({ type: 'enum', enum: WebhookProvider })
    provider!: WebhookProvider;

    @Column({ type: 'text' })
    eventId!: string;

    @Column({ type: 'text' })
    eventType!: string;

    @Column({ type: 'timestamptz' })
    processedAt!: Date;
}
