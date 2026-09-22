import { Module } from '@nestjs/common';
import { ProcessedWebhookEventRepository } from '@parishbooks/database';
import axios from 'axios';
import { OrganizationProfileModule } from '../organization-profile/organization-profile.module';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';
import { OrganizationOnboardingWebhookController } from './organization-onboarding-webhook.controller';
import { OrganizationOnboardingController } from './organization-onboarding.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { CASHFREE_HTTP_CLIENT, CashfreeVendorProvider } from './provider/cashfree-vendor.provider';
import { VendorProvider } from './provider/vendor-provider';

@Module({
    imports: [OrganizationProfileModule],
    controllers: [OrganizationOnboardingController, OrganizationOnboardingWebhookController],
    providers: [
        OrganizationOnboardingService,
        OrganizationOnboardingSubmissionRepository,
        ProcessedWebhookEventRepository,
        { provide: CASHFREE_HTTP_CLIENT, useValue: axios.create({ timeout: 5000 }) },
        { provide: VendorProvider, useClass: CashfreeVendorProvider },
    ],
})
export class OrganizationOnboardingModule {}
