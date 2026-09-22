import { VendorProvider, VendorKycResult, VendorWebhookEvent } from './vendor-provider';

class TestVendorProvider extends VendorProvider {
    createOrUpdateVendor(): Promise<VendorKycResult> {
        throw new Error('not implemented');
    }
    verifyWebhookSignature(): boolean {
        throw new Error('not implemented');
    }
    parseWebhookEvent(): VendorWebhookEvent {
        throw new Error('not implemented');
    }
}

describe('VendorProvider', () => {
    let provider: TestVendorProvider;

    beforeEach(() => {
        provider = new TestVendorProvider();
    });

    it('masks a PAN keeping only the last 4 characters visible', () => {
        expect(provider.maskLast4('ABCDE1234F')).toBe('******234F');
    });

    it('masks a bank account number keeping only the last 4 digits visible', () => {
        expect(provider.maskLast4('123456789012')).toBe('********9012');
    });

    it('fully masks a value of 4 characters or fewer', () => {
        expect(provider.maskLast4('1234')).toBe('****');
        expect(provider.maskLast4('12')).toBe('**');
    });
});
