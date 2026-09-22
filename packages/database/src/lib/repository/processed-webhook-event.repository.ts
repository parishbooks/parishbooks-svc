import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcessedWebhookEvent, WebhookProvider } from '../entities/processed-webhook-event.entity';
import { BaseRepository } from './base.repository';

// Shared across parishbooks-giving-svc (Cashfree) and parishbooks-billing-svc
// (Stripe) — see docs/integrations/cashfree-giving-split.md §3. Lives in
// packages/database rather than being duplicated per service, per
// CLAUDE.md's "shared code goes in libs/shared/*, never copy-pasted
// between services".
@Injectable()
export class ProcessedWebhookEventRepository extends BaseRepository<ProcessedWebhookEvent> {
    constructor(dataSource: DataSource) {
        super(ProcessedWebhookEvent, dataSource);
    }

    async hasProcessed(provider: WebhookProvider, eventId: string): Promise<boolean> {
        const existing = await this.findOneBy({ provider, eventId });
        return existing !== null;
    }

    markProcessed(data: Pick<ProcessedWebhookEvent, 'provider' | 'eventId' | 'eventType'>): Promise<ProcessedWebhookEvent> {
        return this.save(this.create({ ...data, processedAt: new Date() }));
    }
}
