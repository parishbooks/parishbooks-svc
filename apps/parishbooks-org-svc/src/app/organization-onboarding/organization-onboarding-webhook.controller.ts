import { Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@parishbooks/core';
import { ProcessedWebhookEventRepository, WebhookProvider } from '@parishbooks/database';
import type { Request } from 'express';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { VendorProvider } from './provider/vendor-provider';

// Vendor KYC status webhook — verify → dedupe → apply, the same pattern
// used for donation payment webhooks
// (docs/integrations/cashfree-giving-split.md §3, CLAUDE.md rule 5).
@ApiExcludeController()
@Controller('organizations/onboarding')
export class OrganizationOnboardingWebhookController {
    constructor(
        private readonly onboardingService: OrganizationOnboardingService,
        private readonly vendorProvider: VendorProvider,
        private readonly webhookEventRepository: ProcessedWebhookEventRepository,
    ) {}

    @Public()
    @Post('webhook')
    async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-webhook-signature') signature: string | undefined): Promise<{ status: 'ok' }> {
        const rawBody = req.rawBody ?? Buffer.alloc(0);
        if (!this.vendorProvider.verifyWebhookSignature(rawBody, signature)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        const event = this.vendorProvider.parseWebhookEvent(rawBody);
        const alreadyProcessed = await this.webhookEventRepository.hasProcessed(WebhookProvider.CASHFREE, event.eventId);
        if (alreadyProcessed) return { status: 'ok' };

        await this.onboardingService.applyWebhookEvent(event);
        await this.webhookEventRepository.markProcessed({ provider: WebhookProvider.CASHFREE, eventId: event.eventId, eventType: event.eventType });
        return { status: 'ok' };
    }
}
