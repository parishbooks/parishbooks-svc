/** Env vars AuthGuard reads via ConfigService — set these in each consuming app. */
export const AUTH_SERVICE_URL_ENV_KEY = 'AUTH_SERVICE_URL';

/** Opaque Better Auth session bearer, set by the BFF on auth-svc proxy hops only. */
export const SESSION_TOKEN_HEADER = 'x-session-token';

/** Active organization id forwarded by the BFF / Kong callers. */
export const TENANT_ID_HEADER = 'x-tenant-id';
