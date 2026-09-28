import { HttpClientService } from '../../http/http-client.service';
import { INTERNAL_SERVICE_KEY_HEADER } from '../internal/internal-service.constants';

export interface SessionStatus {
    active: boolean;
    isMember: boolean;
    activeOrganizationId: string | null;
}

export function checkSessionStatus(
    httpClient: HttpClientService,
    authServiceUrl: string,
    internalServiceKey: string,
    sessionId: string,
): Promise<SessionStatus> {
    const base = authServiceUrl.replace(/\/$/, '');
    return httpClient.get<SessionStatus>(`${base}/identity/session/${sessionId}/status`, {
        headers: { [INTERNAL_SERVICE_KEY_HEADER]: internalServiceKey },
    });
}
