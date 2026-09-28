import request from 'supertest';
import { AuthenticatedUser, registerAndSignIn, resolveAuthJwtFromBody, uniqueEmail } from '@parishbooks/e2e-supertest';
import { authHttpServer } from '../support/app';

describe('identity organization endpoints (e2e)', () => {
    let owner: AuthenticatedUser;
    let organizationId: string;
    let invitationId: string;
    let inviteeEmail: string;

    beforeAll(async () => {
        owner = await registerAndSignIn(authHttpServer(), 'org-owner');
    });

    it('POST /identity/organizations creates an organization', async () => {
        const slug = `e2e-org-${Date.now()}`;
        const res = await request(authHttpServer())
            .post('/api/identity/organizations')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ name: 'E2E Parish', slug, timezone: 'Asia/Kolkata' });

        organizationId = res.body.id as string;
        expect(res.status).toBe(201);
        expect(res.body.slug).toBe(slug);
    });

    it('GET /identity/organizations lists caller organizations', async () => {
        const res = await request(authHttpServer()).get('/api/identity/organizations').set('Authorization', `Bearer ${owner.token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((org: { id: string }) => org.id === organizationId)).toBe(true);
    });

    it('POST /identity/organizations/active sets the active organization', async () => {
        const res = await request(authHttpServer())
            .post('/api/identity/organizations/active')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ organizationId });

        owner.token = resolveAuthJwtFromBody(res.body);
        expect(res.status).toBe(200);
    });

    it('GET /identity/organizations/:organizationId/members lists members', async () => {
        const res = await request(authHttpServer())
            .get(`/api/identity/organizations/${organizationId}/members`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.members)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('POST /identity/organizations/:organizationId/invitations invites a member', async () => {
        inviteeEmail = uniqueEmail('invitee');
        const res = await request(authHttpServer())
            .post(`/api/identity/organizations/${organizationId}/invitations`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: inviteeEmail, role: 'member', resend: false });

        invitationId = res.body.id as string;
        expect(res.status).toBe(201);
        expect(res.body.email).toBe(inviteeEmail);
    });

    it('POST /identity/organizations/invitations/:invitationId/accept accepts an invitation for another user', async () => {
        const invitee = await registerAndSignIn(authHttpServer(), 'invitee', inviteeEmail);
        const res = await request(authHttpServer())
            .post(`/api/identity/organizations/invitations/${invitationId}/accept`)
            .set('Authorization', `Bearer ${invitee.token}`);

        expect(res.status).toBe(200);
    });
});
