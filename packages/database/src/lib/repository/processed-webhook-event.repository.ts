import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ProcessedWebhookEvent, WebhookProvider } from '../entities/processed-webhook-event.entity';
import { BaseRepository } from './base.repository';

const POSTGRES_UNIQUE_VIOLATION = '23505';

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

    /**
     * Atomically claims an event for processing: attempts the INSERT first
     * and relies on the `(provider, eventId)` unique constraint to reject a
     * concurrent duplicate, instead of a separate hasProcessed() check
     * followed by a separate markProcessed() write. A caller that does
     * check-then-act has a race window where two concurrent deliveries of
     * the same event can both read "not yet processed" and both apply their
     * side effect before either write lands (CLAUDE.md rule 5: dedupe
     * before side effects, not just before crediting a name to it after).
     * Returns true only for the caller that actually won the insert.
     */
    async markProcessedIfNew(data: Pick<ProcessedWebhookEvent, 'provider' | 'eventId' | 'eventType'>): Promise<boolean> {
        try {
            await this.markProcessed(data);
            return true;
        } catch (error) {
            if (this.isUniqueViolation(error)) return false;
            throw error;
        }
    }

    private isUniqueViolation(error: unknown): boolean {
        return error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION;
    }
}
