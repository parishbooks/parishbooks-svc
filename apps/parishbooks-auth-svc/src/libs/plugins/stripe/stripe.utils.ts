import { Subscription } from '@better-auth/stripe';
import { BetterAuthConfig } from '../../../types/auth.types';
import { HttpClientService } from '@parishbooks/core';
import { StripeSubscriptionSummary, syncOrgBilling } from '../../../utils/auth.utils';
import { Logger } from '@nestjs/common';

export class StripeUtils {
    private readonly logger: Logger = new Logger(StripeUtils.name);
    private readonly syncBilling: (referenceId: string, subscription: StripeSubscriptionSummary) => Promise<void>;

    constructor(config: BetterAuthConfig, httpClient: HttpClientService) {
        this.syncBilling = syncOrgBilling(config, httpClient);
    }

    async onSubscriptionUpdate(subscription: Subscription) {
        const { referenceId, plan, status } = subscription;
        await this.syncBilling(referenceId, { plan, status });
    }

    async onSubscriptionCancel({ referenceId }: Subscription) {
        this.logger.log(`Subscription for organization ${referenceId} is scheduled to cancel at period end`);
    }

    async onSubscriptionDeleted(subscription: Subscription) {
        const { referenceId, plan } = subscription;
        await this.syncBilling(referenceId, { plan, status: 'canceled' });
    }
}
