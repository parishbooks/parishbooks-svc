import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProcessedWebhookEventRepository, WebhookProvider } from '@parishbooks/database';
import { OrganizationOnboardingWebhookController } from './organization-onboarding-webhook.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { VendorProvider } from './provider/vendor-provider';

describe('OrganizationOnboardingWebhookController', () => {
    let controller: OrganizationOnboardingWebhookController;
    let onboardingService: { applyWebhookEvent: jest.Mock };
    let vendorProvider: { verifyWebhookSignature: jest.Mock; parseWebhookEvent: jest.Mock };
    let webhookEventRepository: { hasProcessed: jest.Mock; markProcessed: jest.Mock };

    beforeEach(async () => {
        onboardingService = { applyWebhookEvent: jest.fn() };
        vendorProvider = { verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn() };
        webhookEventRepository = { hasProcessed: jest.fn(), markProcessed: jest.fn() };

        const module = await Test.createTestingModule({
            controllers: [OrganizationOnboardingWebhookController],
            providers: [
                { provide: OrganizationOnboardingService, useValue: onboardingService },
                { provide: VendorProvider, useValue: vendorProvider },
                { provide: ProcessedWebhookEventRepository, useValue: webhookEventRepository },
            ],
        }).compile();

        controller = module.get(OrganizationOnboardingWebhookController);
    });

    it('rejects when the signature does not verify', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(false);
        const req = { rawBody: Buffer.from('{}') } as never;

        await expect(controller.handleWebhook(req, 'bad-signature')).rejects.toThrow(UnauthorizedException);
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
    });

    it('is a no-op on a duplicate event id', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        vendorProvider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' });
        webhookEventRepository.hasProcessed.mockResolvedValue(true);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(webhookEventRepository.hasProcessed).toHaveBeenCalledWith(WebhookProvider.CASHFREE, 'evt-1');
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
        expect(webhookEventRepository.markProcessed).not.toHaveBeenCalled();
    });

    it('applies a new event and marks it processed', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        const event = { eventId: 'evt-2', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' as const };
        vendorProvider.parseWebhookEvent.mockReturnValue(event);
        webhookEventRepository.hasProcessed.mockResolvedValue(false);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(onboardingService.applyWebhookEvent).toHaveBeenCalledWith(event);
        expect(webhookEventRepository.markProcessed).toHaveBeenCalledWith({ provider: WebhookProvider.CASHFREE, eventId: 'evt-2', eventType: 'VENDOR_KYC_UPDATE' });
    });
});
