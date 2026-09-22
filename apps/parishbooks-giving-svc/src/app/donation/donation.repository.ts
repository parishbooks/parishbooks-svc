import { Injectable } from '@nestjs/common';
import { BaseRepository, Donation, DonationStatus } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class DonationRepository extends BaseRepository<Donation> {
    constructor(dataSource: DataSource) {
        super(Donation, dataSource);
    }

    findById(organizationId: string, id: string): Promise<Donation | null> {
        return this.findOneBy({ organizationId, id });
    }

    // Backs the retry path in docs/specs/mobile-giving-app.md §4 — a
    // resubmission with the same idempotency key returns the cached row
    // instead of creating a duplicate donation.
    findByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<Donation | null> {
        return this.findOneBy({ organizationId, idempotencyKey });
    }

    findByProviderPaymentId(providerPaymentId: string): Promise<Donation | null> {
        return this.findOneBy({ providerPaymentId });
    }

    createDonation(data: Partial<Donation>): Promise<Donation> {
        return this.save(this.create(data));
    }

    // Only the PAYMENT_SUCCESS webhook handler should call this — see
    // docs/integrations/cashfree-giving-split.md §4.
    markCompleted(id: string, data: Pick<Donation, 'journalEntryId' | 'providerPaymentId' | 'donatedAt'>): Promise<Donation> {
        return this.save(this.create({ id, status: DonationStatus.COMPLETED, ...data }));
    }

    markFailed(id: string, failureReason: string): Promise<Donation> {
        return this.save(this.create({ id, status: DonationStatus.FAILED, failureReason }));
    }
}
