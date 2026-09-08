# JWT-Based Downstream Authentication (BetterAuth `jwt()` Plugin)

> Design for replacing the opaque-session-token + per-hop auth-svc lookup
> with locally-verifiable JWTs across every service's `AuthGuard`, while
> keeping revocation enforced via a lightweight status check.

## Table of Contents

1. Context
2. Goals & Non-Goals
3. auth-svc: JWT Plugin & Payload
4. auth-svc: Issuance Points
5. auth-svc: Session-Status Endpoint
6. `packages/core`: `AuthGuard` Rewrite
7. Data Flow
8. Error Handling
9. Security Considerations
10. Testing
11. Out of Scope / Follow-Ups

## 1. Context

Today, every service (`gateway-svc`, `org-svc`, `billing-svc`, `crm-svc`,
`giving-svc`, `ledger-svc`) applies the same shared `AuthGuard`
(`packages/core/src/lib/guard/auth/auth.guard.ts`) as its global
`APP_GUARD`. On every request, `AuthGuard` extracts the caller's Bearer
token — BetterAuth's opaque session token — and calls
`GET {AUTH_SERVICE_URL}/api/identity/session` with that token forwarded,
to resolve the session (including `activeOrganizationId`) before letting
the request through. `gateway-svc`'s `BaseController` then reads
`activeOrganizationId` off the resolved session (via `AuthContext`) and
forwards it downstream as `x-tenant-id`, alongside the original Bearer
token (CLAUDE.md rule 4).

This means a single client request already costs at least two network
round-trips to auth-svc's session endpoint (once at the gateway, once at
whichever downstream service handles it), and every service trusts the
*gateway's* computed `x-tenant-id` header rather than resolving tenant
identity itself.

BetterAuth's `jwt()` plugin issues short-lived, JWKS-verifiable JWTs
alongside the normal session (it is explicitly not a session
replacement — `bearer()` stays). Each service can verify a JWT's
signature and claims locally via `jose` + the JWKS endpoint, without a
network call, and read `organizationId` directly off a cryptographically
verified payload instead of trusting a forwarded header.

## 2. Goals & Non-Goals

**Goals**

- Every guarded request resolves `organizationId` (and `userId`) from a
  locally-verified JWT claim, not a forwarded header or a full
  session-lookup response body.
- Revocation (sign-out, member removed, session expired) still takes
  effect promptly — enforced via a lightweight DB-backed status check,
  not by trusting the JWT's claims for the life of its expiry alone.
- Clean cutover: the client sends the JWT as its Bearer token everywhere
  after this change. No dual opaque-token/JWT branching in `AuthGuard`.

**Non-Goals**

- This does **not** reduce request volume to auth-svc — the status
  check (§5) replaces the session-lookup call with a cheaper one, but a
  network hop to auth-svc remains on every guarded request at every hop.
  That trade-off was chosen deliberately over trusting an unrevocable
  claim for the JWT's full lifetime.
- `x-tenant-id` forwarding between services is **not** removed —
  CLAUDE.md rule 4 still applies unchanged. What changes is how each
  service *itself* establishes its own trusted `organizationId` (from
  its own verified JWT, not solely from the header a caller sent).
- No change to the client applications (Next.js back-office, Expo app)
  — they live outside this repo. This design specifies the contract
  they must follow (send the JWT as Bearer, call `GET /identity/token`
  to refresh) but doesn't implement client-side code.
- `verifyEmailOtp` is not made session-establishing as part of this
  design (see §4).

## 3. auth-svc: JWT Plugin & Payload

Add `jwt()` to the plugin list in
`apps/parishbooks-auth-svc/src/libs/auth.config.ts`, alongside the
existing `bearer()`:

```ts
import { jwt } from 'better-auth/plugins';

jwt({
    jwt: {
        expirationTime: '10m',
        definePayload: ({ user, session }) => ({
            userId: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            sessionId: session.id,
            organizationId: session.activeOrganizationId,
        }),
        // getSubject left as default (user.id)
    },
})
```

- `expirationTime: '10m'` — short-lived by design (see §9). Configurable
  later without any other code change.
- The payload is shaped to reconstruct today's `AuthSession` /
  `AuthSessionInfo` types (`packages/core/src/lib/guard/auth/auth.types.ts`)
  directly from verified claims — `AuthGuard` builds the same object
  shape it already produces today, so `AuthContext`, `BaseController`,
  and every downstream consumer need **no changes**.
- `sessionId` is the one field with no existing home in `AuthSession` —
  it's added to `AuthSessionInfo` (already has an index signature) and
  used only by `AuthGuard` itself for the status check (§5, §6).
- Signing algorithm, JWKS storage, and key rotation are left at
  defaults (`EdDSA`/`Ed25519`, DB-stored JWKS via the existing TypeORM
  adapter — no `rotationInterval` configured for this first pass; add
  one later if key rotation becomes a requirement).

## 4. auth-svc: Issuance Points

| Endpoint | Change |
| --- | --- |
| `POST /identity/sign-in` | After `authService.api.signInEmail(...)` succeeds, call `authService.api.getToken({ headers })` using the response's session context and set the response `token` field to the JWT (was the opaque session token). |
| `POST /identity/sign-up` | Same pattern — `token` becomes the JWT. |
| `POST /identity/organizations/active` (`setActiveOrganization`) | BetterAuth's `setActiveOrganization` API only returns the `organization` row — no token. `AppService.setActiveOrganization` additionally calls `getToken` after the switch and the response DTO (`OrganizationWithRelationsDto`, `apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`) gains a `token: string` field so the fresh JWT ships in the same response. |
| `GET /identity/token` (**new**) | Thin wrapper around `authService.api.getToken({ headers })`, resolving the session from whatever BetterAuth already accepts (cookie or still-valid opaque token in the request). Two callers: (1) the client, once, right after a Google OAuth redirect completes (`googleSignIn` itself only returns a redirect URL — the session is established inside BetterAuth's own `/api/auth/callback/google` handler, outside our controller, so there is no synchronous response to mint a JWT from); (2) the client generally, to refresh its JWT before the 10-minute expiry. |
| `POST /identity/google/sign-in` | **Unchanged.** Still just returns `{ redirect, url }` — no JWT minted here (see `GET /identity/token` above). |
| `POST /identity/verify-email-otp` | **Unchanged**, and deliberately excluded from this design. `autoSignInAfterVerification` is not enabled on the `emailOTP` plugin, so BetterAuth returns `token: null` from this call today — there is no session to mint a JWT from. Enabling that flag is a separate, out-of-scope decision (it changes sign-up UX, not just JWT issuance). |

The `token` field already exists on `SignInResponseDto` and
`SignUpResponseDto` (`apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`)
— its type doesn't change (`string`), only what it now contains. A new
`GetTokenResponseDto { token: string }` is added for the new endpoint.

## 5. auth-svc: Session-Status Endpoint

New endpoint: `GET /identity/session/:sessionId/status`.

- Guarded the same way `syncBilling` already is —
  `@Public() @UseGuards(InternalServiceGuard)` — since this is called by
  every service's `AuthGuard`, not by an end user.
- Implementation follows the existing raw-query pattern in
  `authorizeOrganizationBillingReference` (`apps/parishbooks-auth-svc/src/utils/auth.utils.ts`) rather than going through BetterAuth's own
  session-resolution machinery (that path expects an opaque token, not
  a session id, and does far more work than a liveness check needs):

  ```sql
  SELECT s."userId", s."activeOrganizationId",
         EXISTS (
             SELECT 1 FROM auth.member m
             WHERE m."organizationId" = s."activeOrganizationId" AND m."userId" = s."userId"
         ) AS "isMember"
  FROM auth.session s
  WHERE s.id = $1 AND s."expiresAt" > now()
  ```

  If the row exists, return
  `{ active: true, userId, activeOrganizationId, isMember }`. If not
  (expired or deleted — e.g. after sign-out), return
  `{ active: false }`.
- `AuthGuard` treats the request as unauthorized unless **all** of:
  `active === true`, `isMember === true`, and the JWT's `organizationId`
  claim matches the status response's live `activeOrganizationId`.
  The `member` check is what catches a user removed from an org — the
  session row's `activeOrganizationId` doesn't get cleared on member
  removal, so without this explicit join a removed member's still-valid
  JWT would keep passing until it naturally expired. The
  `activeOrganizationId` match is what makes an org-switch (which
  updates the session row immediately) take effect before the old JWT's
  10-minute window runs out.
- This mirrors the existing `authorizeOrganizationBillingReference`
  query style (`apps/parishbooks-auth-svc/src/utils/auth.utils.ts`) —
  same double-quoted camelCase identifiers, same reasoning about
  BetterAuth's Postgres naming.

## 6. `packages/core`: `AuthGuard` Rewrite

`packages/core/src/lib/guard/auth/auth.guard.ts` changes from an HTTP
call to auth-svc's session endpoint to:

```ts
async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<IncomingMessage>();
    const token = this.extractBearerToken(req.headers.authorization);
    const session = token ? await this.verifyAndCheckSession(token) : undefined;
    if (!session) throw new UnauthorizedException();
    this.authContext.enterWith(session);
    return true;
}

private async verifyAndCheckSession(token: string): Promise<AuthSession | undefined> {
    try {
        const { payload } = await jwtVerify(token, this.jwks, {
            issuer: this.authServiceUrl,
            audience: this.authServiceUrl,
        });
        const claims = payload as JwtClaims; // sessionId, userId, organizationId, email, name, emailVerified

        const status = await this.checkSessionStatus(claims.sessionId);
        if (!status.active || !status.isMember || status.activeOrganizationId !== claims.organizationId) return undefined;

        return {
            session: { id: claims.sessionId, userId: claims.userId, expiresAt: new Date(payload.exp! * 1000), activeOrganizationId: claims.organizationId },
            user: { id: claims.userId, email: claims.email, name: claims.name, emailVerified: claims.emailVerified },
        };
    } catch {
        return undefined;
    }
}
```

- `this.jwks` is built once per `AuthGuard` instance (constructor) via
  `createRemoteJWKSet(new URL('/api/auth/jwks', authServiceUrl))` — jose
  caches keys internally, so this does not mean a network call per
  request; only on cache miss / `kid` change.
- `checkSessionStatus` calls the new endpoint (§5) with the internal
  service key header, mirroring `syncOrgBilling`'s
  `INTERNAL_SERVICE_KEY_HEADER` usage.
- `AuthSession` / `AuthSessionInfo` (`auth.types.ts`) gain `sessionId`
  is folded into the existing `id` field (no shape change needed there
  — `AuthSessionInfo.id` was already the session id conceptually, just
  previously sourced from auth-svc's response instead of a JWT claim).
  The stale doc comment `/** The validated session/claims context —
  resolved from auth-svc, not decoded locally. */` on `AuthSession` is
  updated to reflect that claims are now decoded locally and only
  liveness is resolved from auth-svc.
- `AUTH_SESSION_PATH_ENV_KEY` / `DEFAULT_SESSION_PATH`
  (`auth.constants.ts`) are removed — no longer used. `AUTH_SERVICE_URL`
  stays (now used to build both the JWKS URL and the status-check URL).
- **No changes needed** in `gateway-svc`'s `BaseController`, or in any
  downstream service's `app.module.ts` — they already consume
  `AuthGuard`/`AuthContext` from `packages/core` and read
  `activeOrganizationId` off the same `AuthSession` shape.

## 7. Data Flow

**Sign-in:**

1. Client → `POST /identity/sign-in` (via gateway, `@AllowAnonymous()`).
2. auth-svc calls `signInEmail`, then `getToken` using the new session's
   context, returns `{ token: <JWT>, user }`.
3. Client stores the JWT, uses it as `Authorization: Bearer <JWT>` for
   all subsequent calls.

**Guarded request (any service, any hop):**

1. `AuthGuard.canActivate` verifies the JWT locally via JWKS (signature,
   expiry, issuer/audience).
2. Calls `GET /identity/session/:sessionId/status` (internal-service-key
   auth) to confirm the session is still live and the claimed org still
   matches.
3. On success, builds `AuthSession` from the verified payload,
   `enterWith()`s it — everything downstream (e.g. `BaseController`
   reading `activeOrganizationId`) works unchanged.
4. On JWT-verification failure or an inactive/mismatched status → `401`.

**Org switch:**

1. Client → `POST /identity/organizations/active`.
2. auth-svc updates `session.activeOrganizationId`, re-mints a JWT with
   the new claim, returns it.
3. Client swaps its stored JWT immediately. Even if it doesn't (e.g. a
   stale mobile client that missed the response), the *old* JWT is
   caught by the status-check's `activeOrganizationId` mismatch on its
   very next use — it doesn't silently keep working against the old
   org.

**Google OAuth / refresh:**

1. Client redirected through BetterAuth's own
   `/api/auth/callback/google` handler; session cookie set.
2. Client calls `GET /identity/token` (cookie-authenticated) to get its
   first JWT.
3. Client repeats this call periodically (before the 10-minute expiry)
   to refresh.

## 8. Error Handling

- JWT signature/issuer/audience/expiry failure → `401`, same
  `UnauthorizedException` as today's failure path.
- Status-check call itself failing (auth-svc down/network error) →
  treated as `401` (fail closed) — matches today's behavior, where a
  failed session-lookup call already produces `undefined` → `401` via
  the existing `catch { return undefined; }` pattern.
- `GET /identity/token` called with no valid BetterAuth session
  (expired cookie, no token) → BetterAuth's own `sessionMiddleware`
  already 401s before our handler runs — no new error handling needed.

## 9. Security Considerations

- **10-minute JWT expiry** — chosen as a starting point balancing
  refresh frequency against exposure window for a leaked token; trivial
  to tune via `expirationTime` alone.
- **Revocation is not solely expiry-bounded** — the per-request status
  check (§5) means sign-out and org-membership changes are enforced on
  the *next* request, not after up to 10 minutes. The JWT's own expiry
  is a backstop for cases the status check doesn't distinguish (none,
  currently — every guarded request always calls it).
- **JWKS endpoint** (`/api/auth/jwks`) is public by BetterAuth default —
  intentional; it exposes only public keys.
- **Internal service key** already exists (`INTERNAL_SERVICE_KEY_HEADER`,
  used by `syncBilling`) — the new status endpoint reuses the exact same
  credential and guard, no new secret to provision.

## 10. Testing

- **auth-svc**: a test asserting `signIn`/`signUp`/`setActiveOrganization`
  responses contain a JWT (decode without verifying — check `organizationId`
  claim matches the org just switched to) rather than the old opaque
  token shape.
- **auth-svc**: a test for `GET /identity/session/:sessionId/status`
  covering active, expired, and non-existent session ids, that it
  rejects a request without the internal service key, and that
  `isMember` is `false` once the corresponding `member` row is deleted
  even though the session row (and its `activeOrganizationId`) is
  untouched — this is the case the `EXISTS` join exists to catch.
- **`packages/core` `AuthGuard`**: a test with a validly-signed JWT
  whose `organizationId` claim doesn't match what the (mocked) status
  endpoint returns — asserts `401`, not a silent pass-through. This is
  the test that would fail if someone "simplified" the guard into
  trusting the JWT claim alone without the status check.
- **`packages/core` `AuthGuard`**: a test with an expired JWT — asserts
  `401` without ever calling the status endpoint (verification should
  fail before that network call).

## 11. Out of Scope / Follow-Ups

- Client-side implementation (Next.js/Expo) — outside this repo.
- `verifyEmailOtp` becoming session-establishing
  (`autoSignInAfterVerification`) — a UX decision, not part of this
  design.
- JWKS key rotation (`rotationInterval`) — left at BetterAuth's default
  (no rotation configured); revisit if/when key rotation becomes a
  requirement.
- Reducing auth-svc round-trips further (e.g. caching status-check
  results briefly per session id) — explicitly deferred; this design
  prioritizes revocation correctness over that latency win, per your
  answer in §9.
