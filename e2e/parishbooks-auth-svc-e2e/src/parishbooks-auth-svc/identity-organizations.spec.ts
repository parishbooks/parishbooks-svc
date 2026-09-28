import {
    api,
    authHeaders,
    AuthenticatedUser,
    registerAndSignIn,
    requestSnapshot,
    snapshotResponse,
    uniqueEmail,
} from '@parishbooks/e2e-support';

describe('identity organization endpoints', () => {
    let owner: AuthenticatedUser;
    let organizationId: string;
    let invitationId: string;
    let inviteeEmail: string;

    beforeAll(async () => {
        owner = await registerAndSignIn('org-owner');
    });

    it('POST /identity/organizations creates an organization', async () => {
        const slug = `e2e-org-${Date.now()}`;
        const created = await api.post(
            '/identity/organizations',
            { name: 'E2E Parish', slug, timezone: 'Asia/Kolkata' },
            authHeaders(owner.token),
        );
        organizationId = created.data.id as string;
        expect(snapshotResponse(created.status, created.data)).toMatchSnapshot();
    });

    it('GET /identity/organizations lists caller organizations', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: '/identity/organizations', ...authHeaders(owner.token) });
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/organizations/active sets the active organization', async () => {
        const activated = await api.post('/identity/organizations/active', { organizationId }, authHeaders(owner.token));
        if (activated.data?.token) owner.token = activated.data.token as string;
        expect(snapshotResponse(activated.status, activated.data)).toMatchSnapshot();
    });

    it('GET /identity/organizations/:organizationId/members lists members', async () => {
        const snapshot = await requestSnapshot({
            method: 'GET',
            url: `/identity/organizations/${organizationId}/members`,
            ...authHeaders(owner.token),
        });
        expect(snapshot).toMatchSnapshot();
    });

    it('POST /identity/organizations/:organizationId/invitations invites a member', async () => {
        inviteeEmail = uniqueEmail('invitee');
        const invited = await api.post(
            `/identity/organizations/${organizationId}/invitations`,
            { email: inviteeEmail, role: 'member', resend: false },
            authHeaders(owner.token),
        );
        invitationId = invited.data.id as string;
        expect(snapshotResponse(invited.status, invited.data)).toMatchSnapshot();
    });

    it('POST /identity/organizations/invitations/:invitationId/accept accepts an invitation for another user', async () => {
        const invitee = await registerAndSignIn('invitee', inviteeEmail);
        const snapshot = await requestSnapshot({
            method: 'POST',
            url: `/identity/organizations/invitations/${invitationId}/accept`,
            ...authHeaders(invitee.token),
        });
        expect(snapshot).toMatchSnapshot();
    });
});
