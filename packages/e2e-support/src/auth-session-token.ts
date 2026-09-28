function looksLikeJwt(value: string): boolean {
    return value.split('.').length >= 3;
}

/** Better Auth bearer plugin expects the opaque session token, not the minted JWT. */
export function resolveAuthSessionBearer(data: { sessionToken?: string | null; token?: string | null }): string {
    if (data.sessionToken) return data.sessionToken;
    if (data.token && !looksLikeJwt(data.token)) return data.token;
    throw new Error('Missing sessionToken (or opaque token) on auth response');
}
