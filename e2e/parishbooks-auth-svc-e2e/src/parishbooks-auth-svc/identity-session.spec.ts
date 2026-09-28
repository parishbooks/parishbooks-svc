import request from 'supertest';
import { AuthenticatedUser, e2eConfig, registerAndSignIn } from '@parishbooks/e2e-supertest';
import { authHttpServer } from '../support/app';

describe('identity session endpoints (e2e)', () => {
    let user: AuthenticatedUser;

    beforeAll(async () => {
        user = await registerAndSignIn(authHttpServer(), 'session');
    });

    it('GET /identity/session returns the active session', async () => {
        const res = await request(authHttpServer()).get('/api/identity/session').set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe(user.userId);
    });

    it('GET /identity/token returns a JWT', async () => {
        const res = await request(authHttpServer()).get('/api/identity/token').set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
    });

    it('PATCH /identity/profile updates the caller profile', async () => {
        const res = await request(authHttpServer())
            .patch('/api/identity/profile')
            .set('Authorization', `Bearer ${user.token}`)
            .send({ name: 'E2E Updated Name' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
    });

    it('POST /identity/change-password rotates the password', async () => {
        const rotated = await request(authHttpServer())
            .post('/api/identity/change-password')
            .set('Authorization', `Bearer ${user.token}`)
            .send({ currentPassword: e2eConfig.testPassword, newPassword: `${e2eConfig.testPassword}!`, revokeOtherSessions: false });
        expect(rotated.status).toBe(200);

        await request(authHttpServer())
            .post('/api/identity/change-password')
            .set('Authorization', `Bearer ${user.token}`)
            .send({ currentPassword: `${e2eConfig.testPassword}!`, newPassword: e2eConfig.testPassword, revokeOtherSessions: false })
            .expect(200);
    });

    it('POST /identity/sign-out ends the session', async () => {
        const res = await request(authHttpServer()).post('/api/identity/sign-out').set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(200);
    });

    it('GET /identity/session rejects a signed-out token', async () => {
        const res = await request(authHttpServer()).get('/api/identity/session').set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(401);
    });
});
