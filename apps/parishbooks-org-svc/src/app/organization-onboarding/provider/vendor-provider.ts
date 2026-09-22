import { VendorKycResult, VendorKycSubmission, VendorWebhookEvent } from './vendor-provider.types';

// Thrown by parseWebhookEvent for a validly-signed payload that is
// nonetheless unparseable or carries a status the provider integration
// doesn't recognize yet. Signature verification only proves the bytes are
// authentic, not that their shape matches what this integration expects —
// a caller should treat this as a client-error response (400) rather than
// letting a raw TypeError surface as an unhandled 500.
export class MalformedWebhookPayloadError extends Error {}

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
