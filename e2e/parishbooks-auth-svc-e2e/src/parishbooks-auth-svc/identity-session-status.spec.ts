import request from 'supertest';
import { e2eConfig, registerAndSignIn } from '@parishbooks/e2e-supertest';
import { authHttpServer } from '../support/app';

describe('identity session status endpoint (e2e)', () => {
    let sessionId: string;

    beforeAll(async () => {
        const user = await registerAndSignIn(authHttpServer(), 'session-status');
        sessionId = user.sessionId;
    });

    it('GET /identity/session/:sessionId/status rejects missing internal key', async () => {
        const res = await request(authHttpServer()).get(`/api/identity/session/${sessionId}/status`);

        expect(res.status).toBe(401);
    });

    it('GET /identity/session/:sessionId/status rejects an invalid internal key', async () => {
        const res = await request(authHttpServer())
            .get(`/api/identity/session/${sessionId}/status`)
            .set('x-internal-service-key', 'wrong-key');

        expect(res.status).toBe(401);
    });

    it('GET /identity/session/:sessionId/status returns status for a live session', async () => {
        const res = await request(authHttpServer())
            .get(`/api/identity/session/${sessionId}/status`)
            .set('x-internal-service-key', e2eConfig.internalServiceKey);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ active: true });
    });

    it('GET /identity/session/:sessionId/status returns inactive for an unknown session', async () => {
        const res = await request(authHttpServer())
            .get('/api/identity/session/00000000-0000-4000-8000-000000000000/status')
            .set('x-internal-service-key', e2eConfig.internalServiceKey);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ active: false, isMember: false, activeOrganizationId: null });
    });
});
