import type { Request } from 'express';
import { AuthSession } from './auth.types';

export const AUTH_SESSION_REQUEST_KEY = 'parishbooksAuthSession';

export function attachAuthSessionToRequest(req: Request, session: AuthSession): void {
    (req as Request & { [AUTH_SESSION_REQUEST_KEY]?: AuthSession })[AUTH_SESSION_REQUEST_KEY] = session;
}

export function getAuthSessionFromRequest(req: Request): AuthSession | undefined {
    return (req as Request & { [AUTH_SESSION_REQUEST_KEY]?: AuthSession })[AUTH_SESSION_REQUEST_KEY];
}
