import { e2eConfig, requestSnapshot, uniqueEmail } from '@parishbooks/e2e-support';

describe('identity public endpoints', () => {
    it('POST /identity/sign-up registers a user', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/sign-up',
            data: { name: 'E2E Sign Up', email: uniqueEmail('sign-up'), password: e2eConfig.testPassword },
        });

        expect(snapshot.status).toBe(201);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/sign-in rejects unknown credentials', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/sign-in',
            data: { email: uniqueEmail('missing-user'), password: 'not-the-password', rememberMe: false },
        });

        expect(snapshot.status).toBe(401);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/sign-in validates the request body', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/sign-in',
            data: { email: 'not-an-email', password: '' },
        });

        expect(snapshot.status).toBe(400);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/google/sign-in returns an OAuth redirect payload', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/google/sign-in',
            data: { callbackURL: 'http://localhost:3000/auth/callback' },
        });

        expect(snapshot.status).toBe(500);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/forgot-password accepts a known email shape', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/forgot-password',
            data: { email: uniqueEmail('forgot-password') },
        });

        expect(snapshot.status).toBe(400);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/reset-password rejects an invalid token', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/reset-password',
            data: { token: 'invalid-reset-token', newPassword: e2eConfig.testPassword },
        });

        expect(snapshot.status).toBe(400);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/email-otp/send accepts a verification OTP request', async () => {
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/email-otp/send',
            data: { email: uniqueEmail('email-otp-send') },
        });

        expect(snapshot.status).toBe(200);
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/email-otp/verify rejects an invalid OTP', async () => {
        const email = uniqueEmail('email-otp-verify');
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: '/identity/email-otp/verify',
            data: { email, otp: '000000' },
        });

        expect(snapshot.status).toBe(400);
        expect(snapshot).toMatchSnapshot();
    });
});
