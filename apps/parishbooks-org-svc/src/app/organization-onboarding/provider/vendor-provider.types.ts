export interface VendorKycSubmission {
    organizationId: string;
    businessName: string;
    panNumber: string;
    bankAccountNumber: string;
    ifsc: string;
    gstin?: string;
}

export interface VendorKycResult {
    vendorId: string;
    rawStatus: string;
}

export type VendorWebhookStatus = 'pending' | 'active' | 'rejected';

export interface VendorWebhookEvent {
    eventId: string;
    eventType: string;
    vendorId: string;
    status: VendorWebhookStatus;
    rejectionReason?: string;
}
