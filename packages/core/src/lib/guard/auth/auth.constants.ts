/** Env vars AuthGuard reads via ConfigService — set these in each consuming app. */
export const AUTH_SERVICE_URL_ENV_KEY = 'AUTH_SERVICE_URL';

/** Opaque Better Auth session bearer, set by the gateway on auth-svc proxy hops only. */
export const SESSION_TOKEN_HEADER = 'x-session-token';
