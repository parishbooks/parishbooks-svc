import { BadRequestException, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@parishbooks/core';
import { ProcessedWebhookEventRepository, WebhookProvider } from '@parishbooks/database';
import type { Request } from 'express';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { MalformedWebhookPayloadError, VendorProvider } from './provider/vendor-provider';
import { VendorWebhookEvent } from './provider/vendor-provider.types';

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

        const event = this.parseEvent(rawBody);

        // Claims the event atomically: the INSERT itself is the dedupe
        // check, so two concurrent deliveries of the same event can't both
        // pass a separate "already processed?" read before either write
        // lands (CLAUDE.md rule 5 — dedupe before the side effect runs, not
        // just before crediting a record of it afterward).
        const isNewEvent = await this.webhookEventRepository.markProcessedIfNew({ provider: WebhookProvider.CASHFREE, eventId: event.eventId, eventType: event.eventType });
        if (!isNewEvent) return { status: 'ok' };

        await this.onboardingService.applyWebhookEvent(event);
        return { status: 'ok' };
    }

    private parseEvent(rawBody: Buffer): VendorWebhookEvent {
        try {
            return this.vendorProvider.parseWebhookEvent(rawBody);
        } catch (error) {
            if (error instanceof MalformedWebhookPayloadError) throw new BadRequestException(error.message);
            throw error;
        }
    }
}
