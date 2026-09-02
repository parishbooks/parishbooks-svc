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

/** The validated session/claims context — resolved from auth-svc, not decoded locally. */
export interface AuthSession {
    session: AuthSessionInfo;
    user: AuthUser;
}
