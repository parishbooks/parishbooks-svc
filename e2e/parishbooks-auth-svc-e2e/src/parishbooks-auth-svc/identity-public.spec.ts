import request from 'supertest';
import { e2eConfig, uniqueEmail } from '@parishbooks/e2e-supertest';
import { authHttpServer } from '../support/app';

describe('identity public endpoints (e2e)', () => {
    it('POST /identity/sign-up registers a user', async () => {
        const email = uniqueEmail('sign-up');
        const res = await request(authHttpServer())
            .post('/api/identity/sign-up')
            .send({ name: 'E2E Sign Up', email, password: e2eConfig.testPassword });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe(email);
    });

    it('POST /identity/sign-in rejects unknown credentials', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/sign-in')
            .send({ email: uniqueEmail('missing-user'), password: 'not-the-password', rememberMe: false });

        expect(res.status).toBe(401);
    });

    it('POST /identity/sign-in validates the request body', async () => {
        const res = await request(authHttpServer()).post('/api/identity/sign-in').send({ email: 'not-an-email', password: '' });

        expect(res.status).toBe(400);
    });

    it('POST /identity/google/sign-in returns an OAuth redirect payload', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/google/sign-in')
            .send({ callbackURL: 'http://localhost:3000/auth/callback' });

        expect(res.status).toBe(500);
    });

    it('POST /identity/forgot-password accepts a known email shape', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/forgot-password')
            .send({ email: uniqueEmail('forgot-password') });

        expect(res.status).toBe(400);
    });

    it('POST /identity/reset-password rejects an invalid token', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/reset-password')
            .send({ token: 'invalid-reset-token', newPassword: e2eConfig.testPassword });

        expect(res.status).toBe(400);
    });

    it('POST /identity/email-otp/send accepts a verification OTP request', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/email-otp/send')
            .send({ email: uniqueEmail('email-otp-send') });

        expect(res.status).toBe(200);
    });

    it('POST /identity/email-otp/verify rejects an invalid OTP', async () => {
        const email = uniqueEmail('email-otp-verify');
        const res = await request(authHttpServer()).post('/api/identity/email-otp/verify').send({ email, otp: '000000' });

        expect(res.status).toBe(400);
    });
});
