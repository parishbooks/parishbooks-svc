import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CashfreeVendorProvider } from './cashfree-vendor.provider';

describe('CashfreeVendorProvider', () => {
    const config = new Map<string, string>([
        ['CASHFREE_API_BASE_URL', 'https://sandbox.cashfree.com'],
        ['CASHFREE_CLIENT_ID', 'test-client-id'],
        ['CASHFREE_CLIENT_SECRET', 'test-client-secret'],
        ['CASHFREE_WEBHOOK_SECRET', 'current-secret'],
        ['CASHFREE_WEBHOOK_SECRET_PREVIOUS', 'previous-secret'],
    ]);
    const configService = { getOrThrow: (key: string) => config.get(key), get: (key: string) => config.get(key) } as unknown as ConfigService;
    let httpClient: { post: jest.Mock };
    let provider: CashfreeVendorProvider;

    beforeEach(() => {
        httpClient = { post: jest.fn() };
        provider = new CashfreeVendorProvider(configService, httpClient as never);
    });

    describe('createOrUpdateVendor', () => {
        it('posts vendor KYC details to the Cashfree Vendor API and returns the vendor id and status', async () => {
            httpClient.post.mockResolvedValue({ data: { vendor_id: 'vendor-123', status: 'PENDING' } });

            const result = await provider.createOrUpdateVendor({
                organizationId: 'org-1',
                businessName: 'St. Example Church',
                panNumber: 'ABCDE1234F',
                bankAccountNumber: '123456789012',
                ifsc: 'HDFC0000123',
                gstin: undefined,
            });

            expect(result).toEqual({ vendorId: 'vendor-123', rawStatus: 'PENDING' });
            expect(httpClient.post).toHaveBeenCalledWith(
                'https://sandbox.cashfree.com/pg/easy-split/vendors',
                expect.objectContaining({ vendor_id: 'org-1', name: 'St. Example Church', pan: 'ABCDE1234F', bank_account_number: '123456789012', bank_ifsc: 'HDFC0000123' }),
                expect.anything(),
            );
        });
    });

    describe('verifyWebhookSignature', () => {
        const rawBody = Buffer.from(JSON.stringify({ type: 'VENDOR_KYC_UPDATE' }));

        it('accepts a signature computed with the current secret', () => {
            const signature = createHmac('sha256', 'current-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
        });

        it('accepts a signature computed with the previous secret during rotation', () => {
            const signature = createHmac('sha256', 'previous-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
        });

        it('rejects a signature computed with an unknown secret', () => {
            const signature = createHmac('sha256', 'wrong-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(false);
        });

        it('rejects a missing signature header', () => {
            expect(provider.verifyWebhookSignature(rawBody, undefined)).toBe(false);
        });
    });

    describe('parseWebhookEvent', () => {
        it('maps a Cashfree vendor KYC webhook payload to a VendorWebhookEvent', () => {
            const payload = {
                type: 'VENDOR_KYC_UPDATE',
                event_id: 'evt-1',
                data: { vendor_id: 'vendor-123', status: 'ACTIVE' },
            };
            const rawBody = Buffer.from(JSON.stringify(payload));

            expect(provider.parseWebhookEvent(rawBody)).toEqual({
                eventId: 'evt-1',
                eventType: 'VENDOR_KYC_UPDATE',
                vendorId: 'vendor-123',
                status: 'active',
                rejectionReason: undefined,
            });
        });

        it('maps a rejected status and carries the rejection reason', () => {
            const payload = {
                type: 'VENDOR_KYC_UPDATE',
                event_id: 'evt-2',
                data: { vendor_id: 'vendor-123', status: 'REJECTED', remarks: 'PAN mismatch' },
            };
            const rawBody = Buffer.from(JSON.stringify(payload));

            expect(provider.parseWebhookEvent(rawBody)).toEqual({
                eventId: 'evt-2',
                eventType: 'VENDOR_KYC_UPDATE',
                vendorId: 'vendor-123',
                status: 'rejected',
                rejectionReason: 'PAN mismatch',
            });
        });
    });
});
