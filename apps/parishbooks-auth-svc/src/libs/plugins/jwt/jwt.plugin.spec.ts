import { jwtPlugin } from './jwt.plugin';

describe('jwtPlugin', () => {
    it('registers as the "jwt" better-auth plugin', () => {
        const plugin = jwtPlugin();
        expect(plugin.id).toBe('jwt');
    });

    it('embeds sessionId, userId, email, and organizationId in the JWT payload', () => {
        const plugin = jwtPlugin();
        const definePayload = plugin.options?.jwt?.definePayload;
        expect(definePayload).toBeDefined();

        const payload = definePayload!({
            user: { id: 'user-1', email: 'jane@example.com', name: 'Jane', emailVerified: true },
            session: { id: 'sess-1', activeOrganizationId: 'org-1' },
        } as never);

        expect(payload).toEqual({
            sessionId: 'sess-1',
            userId: 'user-1',
            email: 'jane@example.com',
            name: 'Jane',
            emailVerified: true,
            organizationId: 'org-1',
        });
    });
});
