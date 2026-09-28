import { AuthenticatedUser, authHeaders, e2eConfig, registerAndSignIn, requestSnapshot } from '@parishbooks/e2e-support';

describe('identity session endpoints', () => {
    let user: AuthenticatedUser;

    beforeAll(async () => {
        user = await registerAndSignIn('session');
    });

    it('GET /identity/session returns the active session', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/session', ...authHeaders(user.token) });
        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/token returns a JWT', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/token', ...authHeaders(user.token) });
        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();
    });

    it('PATCH /identity/profile updates the caller profile', async () => {
        const snapshot = await requestSnapshot({
            method: 'PATCH',
            url: '/identity/profile',
            data: { name: 'E2E Updated Name' },
            ...authHeaders(user.token),
        });
        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/change-password rotates the password', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/change-password',
            data: { currentPassword: e2eConfig.testPassword, newPassword: `${e2eConfig.testPassword}!`, revokeOtherSessions: false },
            ...authHeaders(user.token),
        });
        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();

        await requestSnapshot({
            method: 'POST',
            url: '/identity/change-password',
            data: { currentPassword: `${e2eConfig.testPassword}!`, newPassword: e2eConfig.testPassword, revokeOtherSessions: false },
            ...authHeaders(user.token),
        });
    });

    it('POST /identity/sign-out ends the session', async () => {
        const snapshot = await requestSnapshot({ method: 'POST', url: '/identity/sign-out', ...authHeaders(user.token) });
        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/session rejects a signed-out token', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/session', ...authHeaders(user.token) });
        expect(snapshot.status).toBe(401);
        expect(snapshot).toMatchSnapshot();
    });
});
