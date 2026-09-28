import { internalHeaders, registerAndSignIn, requestSnapshot } from '@parishbooks/e2e-support';

describe('identity session status endpoint', () => {
    let sessionId: string;

    beforeAll(async () => {
        const user = await registerAndSignIn('session-status');
        sessionId = user.sessionId;
    });

    it('GET /identity/session/:sessionId/status rejects missing internal key', async () => {
        const snapshot = await requestSnapshot({ method: 'GET', url: `/identity/session/${sessionId}/status` });
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/session/:sessionId/status rejects an invalid internal key', async () => {
        const snapshot = await requestSnapshot({
            method: 'GET',
            url: `/identity/session/${sessionId}/status`,
            headers: { 'x-internal-service-key': 'wrong-key' },
        });
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/session/:sessionId/status returns status for a live session', async () => {
        const snapshot = await requestSnapshot({
            method: 'GET',
            url: `/identity/session/${sessionId}/status`,
            ...internalHeaders(),
        });
        expect(snapshot).toMatchSnapshot();
    });

    it('GET /identity/session/:sessionId/status returns inactive for an unknown session', async () => {
        const snapshot = await requestSnapshot({
            method: 'GET',
            url: '/identity/session/00000000-0000-4000-8000-000000000000/status',
            ...internalHeaders(),
        });
        expect(snapshot).toMatchSnapshot();
    });
});
