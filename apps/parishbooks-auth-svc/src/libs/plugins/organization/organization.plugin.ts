import { HttpClientService } from '@parishbooks/core';
import { organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../../../types/auth.types';
import { OrganizationUtils } from './organization.utils';
import { Logger } from '@nestjs/common';

export const organizationPlugin = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    const logger = new Logger('OrganizationPlugin');
    const organizationUtils = new OrganizationUtils(config, httpClient);

    return organization({
        invitationLimit: 1,
        allowUserToCreateOrganization: true,
        organizationHooks: {
            afterCreateOrganization: async ({ organization }) => {
                logger.log('Creating organization profile');
                await organizationUtils.createProfile(organization);
            },
        },
    });
};
