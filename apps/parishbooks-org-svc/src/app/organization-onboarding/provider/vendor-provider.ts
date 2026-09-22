import { VendorKycResult, VendorKycSubmission, VendorWebhookEvent } from './vendor-provider.types';

// Provider-agnostic contract for payment-provider vendor onboarding
// (docs/superpowers/specs/2026-09-22-vendor-onboarding-kyc-design.md §3).
// An abstract class rather than a bare interface so behavior common to
// every provider — masking sensitive values before they're stored — lives
// once here instead of being duplicated per implementation.
export abstract class VendorProvider {
    abstract createOrUpdateVendor(submission: VendorKycSubmission): Promise<VendorKycResult>;
    abstract verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
    abstract parseWebhookEvent(rawBody: Buffer): VendorWebhookEvent;

    maskLast4(value: string): string {
        const trimmed = value.trim();
        if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
        return '*'.repeat(trimmed.length - 4) + trimmed.slice(-4);
    }
}
