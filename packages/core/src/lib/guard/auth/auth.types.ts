export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    emailVerified?: boolean;
    [key: string]: unknown;
}

export interface AuthSessionInfo {
    id: string;
    userId: string;
    expiresAt: string | Date;
    /** Set by BetterAuth's organization plugin once the caller has an active org. */
    activeOrganizationId?: string;
    [key: string]: unknown;
}

/**
 * The validated session/claims context. Built locally from a verified JWT
 * payload (see `jwt-verifier.ts`) plus a liveness/membership check against
 * auth-svc (see `session-status.client.ts`) — not decoded from a raw
 * auth-svc session-lookup response body.
 */
export interface AuthSession {
    session: AuthSessionInfo;
    user: AuthUser;
}

/** Claims embedded in the JWT payload by auth-svc's jwt() plugin `definePayload`. */
export interface JwtClaims {
    sessionId: string;
    userId: string;
    email: string;
    name?: string;
    emailVerified?: boolean;
    organizationId?: string;
    /** Standard JWT expiry claim (unix seconds) — used to populate AuthSessionInfo.expiresAt. */
    exp: number;
}
