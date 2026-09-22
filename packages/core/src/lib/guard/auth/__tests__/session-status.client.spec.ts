import { HttpClientService } from '../../../http/http-client.service';
import { checkSessionStatus } from '../session-status.client';

describe('checkSessionStatus', () => {
    it('calls the auth-svc status endpoint with the internal service key header', async () => {
        const httpClient = { get: jest.fn().mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' }) };

        const result = await checkSessionStatus(httpClient as unknown as HttpClientService, 'http://localhost:8001', 'shared-secret', 'sess-1');

        expect(httpClient.get).toHaveBeenCalledWith('http://localhost:8001/api/identity/session/sess-1/status', {
            headers: { 'x-internal-service-key': 'shared-secret' },
        });
        expect(result).toEqual({ active: true, isMember: true, activeOrganizationId: 'org-1' });
    });
});
