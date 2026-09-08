import { Logger } from '@nestjs/common';
import { HttpClientService, INTERNAL_SERVICE_KEY_HEADER } from '@parishbooks/core';
import { Organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../../../types/auth.types';

export class OrganizationUtils {
    private readonly logger: Logger = new Logger(OrganizationUtils.name);

    constructor(
        private readonly config: BetterAuthConfig,
        private readonly httpClient: HttpClientService,
    ) {}

    /**
     * Creates the org-svc profile row for a newly created organization.
     * Called from a hook with no request context, so it authenticates as a
     * system-to-system caller rather than forwarding a user's Bearer token.
     */
    async createProfile(organization: Organization & Record<string, unknown>) {
        const metadata = typeof organization.metadata === 'object' && organization.metadata ? (organization.metadata as Record<string, unknown>) : {};
        const timezone = metadata.timezone;
        const endpoint = `${this.config.orgServiceUrl}/api/organizations/${organization.id}/profile`;
        try {
            await this.httpClient.post(
                endpoint,
                { timezone },
                { headers: { [INTERNAL_SERVICE_KEY_HEADER]: this.config.internalServiceKey, 'x-tenant-id': organization.id } },
            );
        } catch (error) {
            this.logger.error(`Failed to create org-svc profile for organization ${organization.id}: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        }
    }
}
