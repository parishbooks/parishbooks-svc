import { HttpClientService } from '@parishbooks/core';
import { organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../../../types/auth.types';
import { OrganizationUtils } from './organization.utils';

export const organizationPlugin = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    const organizationUtils = new OrganizationUtils(config, httpClient);

    return organization({
        invitationLimit: 1,
        allowUserToCreateOrganization: true,
        organizationHooks: {
            afterCreateOrganization: async ({ organization }) => {
                await organizationUtils.createProfile(organization);
            },
        },
    });
};
