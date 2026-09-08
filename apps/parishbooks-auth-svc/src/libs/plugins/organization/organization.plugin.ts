import { organization } from 'better-auth/plugins';

export const organizationPlugin = () => organization({ invitationLimit: 1, allowUserToCreateOrganization: true, organizationHooks: {} });
