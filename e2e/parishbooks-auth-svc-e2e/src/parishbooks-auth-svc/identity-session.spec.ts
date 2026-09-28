import { AuthenticatedUser, registerAndSignIn } from '../support/auth-fixtures';
import { e2eConfig } from '../support/e2e-config';
import { authHeaders, requestSnapshot } from '../support/http-client';

describe('identity session endpoints', () => {
    let user: AuthenticatedUser;

    beforeAll(async () => {
        user = await registerAndSignIn('session');
    });

    it('GET /identity/session returns the active session', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/session', ...authHeaders(user.token) });
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/token returns a JWT', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/token', ...authHeaders(user.token) });
        expect(snapshot).toMatchSnapshot();
    });

    it('PATCH /identity/profile updates the caller profile', async () => {
        const snapshot = await requestSnapshot({
            method: 'PATCH',
            url: '/identity/profile',
            data: { name: 'E2E Updated Name' },
            ...authHeaders(user.token),
        });
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/change-password rotates the password', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/change-password',
            data: { currentPassword: e2eConfig.testPassword, newPassword: `${e2eConfig.testPassword}!`, revokeOtherSessions: false },
            ...authHeaders(user.token),
        });
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
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/session rejects a signed-out token', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/session', ...authHeaders(user.token) });
        expect(snapshot).toMatchSnapshot();
    });
});
