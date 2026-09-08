import { jwt } from 'better-auth/plugins';

export const jwtPlugin = () =>
    jwt({
        jwt: {
            expirationTime: '10m',
            definePayload: ({ user, session }) => ({
                sessionId: session.id,
                userId: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
                organizationId: session.activeOrganizationId,
            }),
        },
    });
