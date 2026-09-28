import request from 'supertest';
import { e2eConfig, registerAndSignIn } from '@parishbooks/e2e-supertest';
import { authHttpServer, gatewayHttpServer } from '../support/app';

describe('Gateway auth proxy (e2e)', () => {
    it('GET /api/auth/identity/session accepts a client JWT via x-session-token forwarding', async () => {
        const user = await registerAndSignIn(authHttpServer(), 'gateway-jwt');

        const signIn = await request(gatewayHttpServer())
            .post('/api/auth/identity/sign-in')
            .send({ email: user.email, password: e2eConfig.testPassword, rememberMe: false })
            .expect(200);

        const jwt = signIn.body.token as string;
        expect(typeof jwt).toBe('string');
        expect(jwt.split('.').length).toBe(3);

        const session = await request(gatewayHttpServer())
            .get('/api/auth/identity/session')
            .set('Authorization', `Bearer ${jwt}`)
            .expect(200);

        expect(session.body.user.email).toBe(user.email);
    });
});
