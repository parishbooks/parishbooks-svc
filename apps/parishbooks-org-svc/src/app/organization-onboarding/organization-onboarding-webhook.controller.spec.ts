import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProcessedWebhookEventRepository, WebhookProvider } from '@parishbooks/database';
import { OrganizationOnboardingWebhookController } from './organization-onboarding-webhook.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { MalformedWebhookPayloadError, VendorProvider } from './provider/vendor-provider';

describe('OrganizationOnboardingWebhookController', () => {
    let controller: OrganizationOnboardingWebhookController;
    let onboardingService: { applyWebhookEvent: jest.Mock };
    let vendorProvider: { verifyWebhookSignature: jest.Mock; parseWebhookEvent: jest.Mock };
    let webhookEventRepository: { markProcessedIfNew: jest.Mock };

    beforeEach(async () => {
        onboardingService = { applyWebhookEvent: jest.fn() };
        vendorProvider = { verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn() };
        webhookEventRepository = { markProcessedIfNew: jest.fn() };

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

    it('responds 400 instead of crashing on a malformed or unrecognized payload', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        vendorProvider.parseWebhookEvent.mockImplementation(() => {
            throw new MalformedWebhookPayloadError('bad payload');
        });
        const req = { rawBody: Buffer.from('{}') } as never;

        await expect(controller.handleWebhook(req, 'good-signature')).rejects.toThrow(BadRequestException);
        expect(webhookEventRepository.markProcessedIfNew).not.toHaveBeenCalled();
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
    });

    it('is a no-op when the event was already claimed by a concurrent delivery', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        vendorProvider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' });
        webhookEventRepository.markProcessedIfNew.mockResolvedValue(false);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(webhookEventRepository.markProcessedIfNew).toHaveBeenCalledWith({ provider: WebhookProvider.CASHFREE, eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE' });
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
    });

    it('applies a newly claimed event', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        const event = { eventId: 'evt-2', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' as const };
        vendorProvider.parseWebhookEvent.mockReturnValue(event);
        webhookEventRepository.markProcessedIfNew.mockResolvedValue(true);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(onboardingService.applyWebhookEvent).toHaveBeenCalledWith(event);
    });
});
