import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosInstance } from 'axios';
import { VendorProvider } from './vendor-provider';
import { VendorKycResult, VendorKycSubmission, VendorWebhookEvent, VendorWebhookStatus } from './vendor-provider.types';

export const CASHFREE_HTTP_CLIENT = Symbol('CASHFREE_HTTP_CLIENT');

const STATUS_MAP: Record<string, VendorWebhookStatus> = {
    PENDING: 'pending',
    ACTIVE: 'active',
    REJECTED: 'rejected',
};

// Concrete VendorProvider for Cashfree's Easy Split Vendor API
// (docs/integrations/cashfree-giving-split.md §1, §3). This is the one
// place in org-svc allowed to know the provider's name and wire format —
// everything above it (OnboardingService, controllers, DTOs) depends only
// on the VendorProvider abstract class.
@Injectable()
export class CashfreeVendorProvider extends VendorProvider {
    private readonly baseUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly webhookSecret: string;
    private readonly previousWebhookSecret?: string;

    constructor(
        private readonly configService: ConfigService,
        @Inject(CASHFREE_HTTP_CLIENT) private readonly httpClient: AxiosInstance,
    ) {
        super();
        this.baseUrl = this.configService.getOrThrow<string>('CASHFREE_API_BASE_URL');
        this.clientId = this.configService.getOrThrow<string>('CASHFREE_CLIENT_ID');
        this.clientSecret = this.configService.getOrThrow<string>('CASHFREE_CLIENT_SECRET');
        this.webhookSecret = this.configService.getOrThrow<string>('CASHFREE_WEBHOOK_SECRET');
        this.previousWebhookSecret = this.configService.get<string>('CASHFREE_WEBHOOK_SECRET_PREVIOUS');
    }

    async createOrUpdateVendor(submission: VendorKycSubmission): Promise<VendorKycResult> {
        const response = await this.httpClient.post(
            `${this.baseUrl}/pg/easy-split/vendors`,
            {
                vendor_id: submission.organizationId,
                name: submission.businessName,
                pan: submission.panNumber,
                bank_account_number: submission.bankAccountNumber,
                bank_ifsc: submission.ifsc,
                gstin: submission.gstin,
            },
            { headers: { 'x-client-id': this.clientId, 'x-client-secret': this.clientSecret } },
        );
        return { vendorId: response.data.vendor_id, rawStatus: response.data.status };
    }

    verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
        if (!signatureHeader) return false;
        const candidates = [this.webhookSecret, this.previousWebhookSecret].filter((secret): secret is string => Boolean(secret));
        return candidates.some((secret) => this.matchesSignature(rawBody, signatureHeader, secret));
    }

    parseWebhookEvent(rawBody: Buffer): VendorWebhookEvent {
        const payload = JSON.parse(rawBody.toString('utf8'));
        return {
            eventId: payload.event_id,
            eventType: payload.type,
            vendorId: payload.data.vendor_id,
            status: STATUS_MAP[payload.data.status] ?? 'pending',
            rejectionReason: payload.data.remarks,
        };
    }

    private matchesSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
        const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const providedBuffer = Buffer.from(signatureHeader, 'utf8');
        if (expectedBuffer.length !== providedBuffer.length) return false;
        return timingSafeEqual(expectedBuffer, providedBuffer);
    }
}
