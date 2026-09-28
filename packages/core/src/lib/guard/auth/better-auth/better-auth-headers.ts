/** Headers Better Auth server APIs expect (opaque session bearer, not the ParishBooks JWT). */
export function opaqueSessionHeaders(sessionToken: string): Headers {
    return new Headers({ authorization: `Bearer ${sessionToken}` });
}
