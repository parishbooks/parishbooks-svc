# JWT-Based Downstream Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AuthGuard`'s per-request call to auth-svc's session-lookup endpoint with local JWKS verification of a short-lived JWT (BetterAuth's `jwt()` plugin), backed by a lightweight auth-svc status endpoint that keeps revocation (sign-out, org switch, member removal) enforced on every request.

**Architecture:** auth-svc mints a JWT (embedding `sessionId`, `userId`, `organizationId`, and basic user fields via `definePayload`) at sign-in, sign-up, org-switch, and a new `GET /identity/token` endpoint. Every service's shared `AuthGuard` (`packages/core`) verifies that JWT locally via `jose` + auth-svc's JWKS endpoint, then confirms liveness + membership via a new internal-service-guarded `GET /identity/session/:sessionId/status` endpoint before building the same `AuthSession` shape it already produces today — so `AuthContext`, `BaseController`, and every downstream consumer need no changes.

**Tech Stack:** NestJS 11, `better-auth` 1.7.2 `jwt()` plugin, `jose` 6.x for local JWT/JWKS verification, `pg.Pool` raw queries (matching the existing `auth.utils.ts` pattern for BetterAuth-owned tables), Jest + `@swc/jest`.

**Spec:** `docs/superpowers/specs/2026-09-08-jwt-auth-integration-design.md`

## Global Constraints

- JWT expiry is 10 minutes (`expirationTime: '10m'`) — spec §3, §9.
- **No god modules/functions/methods** (CLAUDE.md, Working Conventions): every task below decomposes logic into small, single-purpose functions/methods rather than one large function doing everything. Follow this shape exactly as written in each task — don't collapse the helpers back together.
- CLAUDE.md rule 4 (forward `x-tenant-id` + caller's Bearer token on every inter-service call) is unchanged by this plan — not touched.
- BetterAuth-owned tables (`auth.session`, `auth.member`) are queried via raw `pg.Pool`, not TypeORM entities — matches the existing `authorizeOrganizationBillingReference` precedent in `apps/parishbooks-auth-svc/src/utils/auth.utils.ts`. Do not introduce TypeORM entities for them.
- Every service that runs `AuthGuard` (gateway-svc, org-svc, billing-svc, crm-svc, giving-svc, ledger-svc — plus auth-svc's own outbound calls) needs `INTERNAL_SERVICE_KEY` and `AUTH_SERVICE_URL` set in its deployment environment. This is a deployment/ops concern, not a code change (no `.env` files are committed in this repo) — flagged here so it isn't missed at rollout, verified in Task 11.
- Jest is already configured with `transformIgnorePatterns: []` + `@swc/jest` in both `packages/core` and `apps/parishbooks-auth-svc` (see their `jest.config.cts`), specifically so ESM-only packages (`jose`, `better-auth/plugins`) import cleanly in specs — no special mocking is needed for that.

---

## Task 1: Fix the stale `AppService#createOrganization` test

`apps/parishbooks-auth-svc/src/app/app.service.spec.ts` still tests a version of `createOrganization` that called `httpClient.post` directly — that code path was removed in an earlier refactor (org-svc profile creation moved into a BetterAuth `organizationHooks` hook). The suite is currently red. This is unrelated to the JWT feature but blocks a clean baseline before Task 9 extends this same file, so it's fixed first.

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/app/app.service.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `AppService.createOrganization(dto, headers)` — current signature, `apps/parishbooks-auth-svc/src/app/app.service.ts:66-69`.

- [ ] **Step 1: Confirm the current failure**

Run: `npx nx run parishbooks-auth-svc:test`
Expected: FAIL — 2 failing tests in `AppService#createOrganization` referencing `httpClient.post`.

- [ ] **Step 2: Rewrite the spec to match current behavior**

```ts
jest.mock('../auth', () => ({ auth: {} }));

import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';

describe('AppService#createOrganization', () => {
    let service: AppService;
    let authService: { api: { createOrganization: jest.Mock } };

    const dto = { name: 'St. Mary Parish', slug: 'st-mary-parish', timezone: 'Asia/Kolkata' };
    const headers = new Headers({ authorization: 'Bearer token-123' });

    beforeEach(async () => {
        authService = { api: { createOrganization: jest.fn() } };

        const module = await Test.createTestingModule({
            providers: [AppService, { provide: AuthService, useValue: authService }],
        }).compile();

        service = module.get(AppService);
    });

    it('folds timezone into organization metadata', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1', name: dto.name, slug: dto.slug });

        const result = await service.createOrganization(dto, headers);

        expect(authService.api.createOrganization).toHaveBeenCalledWith({
            body: { name: dto.name, slug: dto.slug, metadata: { timezone: 'Asia/Kolkata' } },
            headers,
        });
        expect(result).toEqual({ id: 'org-1', name: dto.name, slug: dto.slug });
    });

    it('propagates a failure from BetterAuth', async () => {
        authService.api.createOrganization.mockRejectedValue(new Error('slug already exists'));

        await expect(service.createOrganization(dto, headers)).rejects.toThrow('slug already exists');
    });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx nx run parishbooks-auth-svc:test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/app.service.spec.ts
git commit -m "test(auth-svc): fix stale createOrganization spec after org-svc hook refactor"
```

---

## Task 2: `packages/core` — `jose` dependency and `JwtClaims` type

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/lib/guard/auth/auth.types.ts`

**Interfaces:**
- Produces: `JwtClaims` interface, consumed by Task 3 (`jwt-verifier.ts`) and Task 5 (`auth.guard.ts`).

- [ ] **Step 1: Add the `jose` dependency**

In `packages/core/package.json`, add to `dependencies` (alphabetical, matching the existing list style):

```json
"jose": "^6.2.10",
```

Full `dependencies` block after the change:

```json
"dependencies": {
    "tslib": "^2.3.0",
    "@nestjs/axios": "^4.0.0",
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^12.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^11.4.7",
    "axios": "^1.6.0",
    "jose": "^6.2.10",
    "rxjs": "^7.8.0"
}
```

- [ ] **Step 2: Install**

Run: `bun install`
Expected: lockfile updates to record `jose` as a direct dependency of `@parishbooks/core` (it's already present transitively via `better-auth`, so this should not change the resolved version, `6.2.10`).

- [ ] **Step 3: Add `JwtClaims` and update the `AuthSession` doc comment**

Replace the full contents of `packages/core/src/lib/guard/auth/auth.types.ts`:

```ts
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
```

- [ ] **Step 4: Typecheck**

Run: `npx nx run core:typecheck`
Expected: PASS (nothing consumes `JwtClaims` yet, so this only validates the file itself is well-formed).

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json bun.lock packages/core/src/lib/guard/auth/auth.types.ts
git commit -m "feat(core): add jose dependency and JwtClaims type for local JWT verification"
```

---

## Task 3: `packages/core` — JWT verification (`jwt-verifier.ts`)

**Files:**
- Create: `packages/core/src/lib/guard/auth/jwt-verifier.ts`
- Test: `packages/core/src/lib/guard/auth/jwt-verifier.spec.ts`

**Interfaces:**
- Consumes: `JwtClaims` from `./auth.types` (Task 2).
- Produces: `Jwks` type, `buildRemoteJwks(authServiceUrl: string): Jwks`, `verifyAuthToken(token: string, jwks: Jwks, authServiceUrl: string): Promise<JwtClaims>` — consumed by Task 5 (`auth.guard.ts`).

- [ ] **Step 1: Write the failing test**

```ts
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type JWK } from 'jose';
import { verifyAuthToken } from './jwt-verifier';

describe('verifyAuthToken', () => {
    const issuer = 'http://localhost:8001';
    let jwks: ReturnType<typeof createLocalJWKSet>;
    let privateKey: CryptoKey;
    const kid = 'test-key';

    beforeAll(async () => {
        const { privateKey: priv, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        privateKey = priv;
        const publicJwk = await exportJWK(publicKey);
        jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid, alg: 'EdDSA' } as JWK] });
    });

    async function sign(claims: Record<string, unknown>, expiresIn = '10m'): Promise<string> {
        return new SignJWT(claims)
            .setProtectedHeader({ alg: 'EdDSA', kid })
            .setIssuedAt()
            .setIssuer(issuer)
            .setAudience(issuer)
            .setExpirationTime(expiresIn)
            .sign(privateKey);
    }

    it('returns claims from a validly signed token', async () => {
        const token = await sign({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com', organizationId: 'org-1' });

        const claims = await verifyAuthToken(token, jwks, issuer);

        expect(claims).toMatchObject({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com', organizationId: 'org-1' });
        expect(typeof claims.exp).toBe('number');
    });

    it('rejects a token signed for a different issuer', async () => {
        const token = await new SignJWT({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com' })
            .setProtectedHeader({ alg: 'EdDSA', kid })
            .setIssuedAt()
            .setIssuer('http://evil.example.com')
            .setAudience(issuer)
            .setExpirationTime('10m')
            .sign(privateKey);

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow();
    });

    it('rejects an expired token', async () => {
        const token = await sign({ sessionId: 'sess-1', userId: 'user-1', email: 'jane@example.com' }, '-10s');

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow();
    });

    it('rejects a token missing required claims', async () => {
        const token = await sign({ userId: 'user-1', email: 'jane@example.com' });

        await expect(verifyAuthToken(token, jwks, issuer)).rejects.toThrow('missing required claims');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx run core:test --testFile=jwt-verifier.spec.ts`
Expected: FAIL with "Cannot find module './jwt-verifier'".

- [ ] **Step 3: Implement**

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { JwtClaims } from './auth.types';

export type Jwks = ReturnType<typeof createRemoteJWKSet>;

export const buildRemoteJwks = (authServiceUrl: string): Jwks => createRemoteJWKSet(new URL('/api/auth/jwks', authServiceUrl));

export async function verifyAuthToken(token: string, jwks: Jwks, authServiceUrl: string): Promise<JwtClaims> {
    const { payload } = await jwtVerify(token, jwks, { issuer: authServiceUrl, audience: authServiceUrl });
    return toJwtClaims(payload);
}

function toJwtClaims(payload: JWTPayload): JwtClaims {
    const claims = payload as Record<string, unknown>;
    const { sessionId, userId, email, exp } = claims;
    if (typeof sessionId !== 'string' || typeof userId !== 'string' || typeof email !== 'string' || typeof exp !== 'number') {
        throw new Error('JWT payload is missing required claims');
    }
    return {
        sessionId,
        userId,
        email,
        exp,
        name: typeof claims.name === 'string' ? claims.name : undefined,
        emailVerified: typeof claims.emailVerified === 'boolean' ? claims.emailVerified : undefined,
        organizationId: typeof claims.organizationId === 'string' ? claims.organizationId : undefined,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx run core:test --testFile=jwt-verifier.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lib/guard/auth/jwt-verifier.ts packages/core/src/lib/guard/auth/jwt-verifier.spec.ts
git commit -m "feat(core): add local JWT verification via jose + remote JWKS"
```

---

## Task 4: `packages/core` — session-status HTTP client

**Files:**
- Create: `packages/core/src/lib/guard/auth/session-status.client.ts`
- Test: `packages/core/src/lib/guard/auth/session-status.client.spec.ts`

**Interfaces:**
- Consumes: `HttpClientService` (`../../http/http-client.service`), `INTERNAL_SERVICE_KEY_HEADER` (`../internal/internal-service.constants`).
- Produces: `SessionStatus` interface, `checkSessionStatus(httpClient, authServiceUrl, internalServiceKey, sessionId): Promise<SessionStatus>` — consumed by Task 5 (`auth.guard.ts`) and returned by Task 7's endpoint.

- [ ] **Step 1: Write the failing test**

```ts
import { HttpClientService } from '../../http/http-client.service';
import { checkSessionStatus } from './session-status.client';

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx run core:test --testFile=session-status.client.spec.ts`
Expected: FAIL with "Cannot find module './session-status.client'".

- [ ] **Step 3: Implement**

```ts
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
    return httpClient.get<SessionStatus>(`${authServiceUrl}/api/identity/session/${sessionId}/status`, {
        headers: { [INTERNAL_SERVICE_KEY_HEADER]: internalServiceKey },
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx run core:test --testFile=session-status.client.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lib/guard/auth/session-status.client.ts packages/core/src/lib/guard/auth/session-status.client.spec.ts
git commit -m "feat(core): add auth-svc session-status client for revocation checks"
```

---

## Task 5: `packages/core` — rewrite `AuthGuard`

**Files:**
- Modify: `packages/core/src/lib/guard/auth/auth.guard.ts`
- Modify: `packages/core/src/lib/guard/auth/auth.constants.ts`
- Test: `packages/core/src/lib/guard/auth/auth.guard.spec.ts` (new)

**Interfaces:**
- Consumes: `verifyAuthToken`, `buildRemoteJwks`, `Jwks` (Task 3); `checkSessionStatus`, `SessionStatus` (Task 4); `AuthSession`, `JwtClaims` (Task 2).
- Produces: `AuthGuard` — public interface (constructor signature, `canActivate`) unchanged from today, so no consumer elsewhere needs to change.

- [ ] **Step 1: Prune the now-unused session-path constants**

Replace the full contents of `packages/core/src/lib/guard/auth/auth.constants.ts`:

```ts
/** Env vars AuthGuard reads via ConfigService — set these in each consuming app. */
export const AUTH_SERVICE_URL_ENV_KEY = 'AUTH_SERVICE_URL';
```

- [ ] **Step 2: Write the failing test**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthContext } from './auth-context';
import { AuthGuard } from './auth.guard';
import * as jwtVerifier from './jwt-verifier';
import * as sessionStatusClient from './session-status.client';

jest.mock('./jwt-verifier');
jest.mock('./session-status.client');

function buildContext(headers: Record<string, string>): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let httpClient: { get: jest.Mock };
    let authContext: { enterWith: jest.Mock };
    let configService: { getOrThrow: jest.Mock };
    let reflector: { getAllAndOverride: jest.Mock };

    beforeEach(() => {
        httpClient = { get: jest.fn() };
        authContext = { enterWith: jest.fn() };
        configService = { getOrThrow: jest.fn((key: string) => (key === 'AUTH_SERVICE_URL' ? 'http://localhost:8001' : 'shared-secret')) };
        reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
        guard = new AuthGuard(
            httpClient as never,
            authContext as unknown as AuthContext,
            configService as unknown as ConfigService,
            reflector as unknown as Reflector,
        );
        jest.mocked(jwtVerifier.buildRemoteJwks).mockReturnValue('fake-jwks' as never);
    });

    it('allows a @Public route without checking the token', async () => {
        reflector.getAllAndOverride.mockReturnValue(true);

        const result = await guard.canActivate(buildContext({}));

        expect(result).toBe(true);
        expect(authContext.enterWith).not.toHaveBeenCalled();
    });

    it('rejects a request with no Authorization header', async () => {
        await expect(guard.canActivate(buildContext({}))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a request with a malformed Authorization header', async () => {
        await expect(guard.canActivate(buildContext({ authorization: 'not-bearer token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the JWT fails verification', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockRejectedValue(new Error('bad signature'));

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer bad-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the session status check reports inactive', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: false, isMember: false, activeOrganizationId: null });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the JWT organizationId claim does not match the live session', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-2' });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the caller is no longer a member of the claimed org', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({ sessionId: 's1', userId: 'u1', email: 'jane@example.com', organizationId: 'org-1', exp: 9999999999 });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: false, activeOrganizationId: 'org-1' });

        await expect(guard.canActivate(buildContext({ authorization: 'Bearer good-token' }))).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a valid JWT with an active, matching session and enters the resolved AuthSession into AuthContext', async () => {
        jest.mocked(jwtVerifier.verifyAuthToken).mockResolvedValue({
            sessionId: 's1',
            userId: 'u1',
            email: 'jane@example.com',
            name: 'Jane',
            emailVerified: true,
            organizationId: 'org-1',
            exp: 1893456000,
        });
        jest.mocked(sessionStatusClient.checkSessionStatus).mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' });

        const result = await guard.canActivate(buildContext({ authorization: 'Bearer good-token' }));

        expect(result).toBe(true);
        expect(authContext.enterWith).toHaveBeenCalledWith({
            session: { id: 's1', userId: 'u1', expiresAt: new Date(1893456000 * 1000), activeOrganizationId: 'org-1' },
            user: { id: 'u1', email: 'jane@example.com', name: 'Jane', emailVerified: true },
        });
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx nx run core:test --testFile=auth.guard.spec.ts`
Expected: FAIL — either a compile error (guard doesn't use the mocked modules yet) or assertion failures against the current session-lookup implementation.

- [ ] **Step 4: Rewrite `AuthGuard`**

Replace the full contents of `packages/core/src/lib/guard/auth/auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IncomingMessage } from 'node:http';
import { HttpClientService } from '../../http/http-client.service';
import { INTERNAL_SERVICE_KEY_ENV_KEY } from '../internal/internal-service.constants';
import { AuthContext } from './auth-context';
import { AUTH_SERVICE_URL_ENV_KEY } from './auth.constants';
import { AuthSession, JwtClaims } from './auth.types';
import { buildRemoteJwks, Jwks, verifyAuthToken } from './jwt-verifier';
import { IS_PUBLIC_KEY } from './public.decorator';
import { checkSessionStatus, SessionStatus } from './session-status.client';

/**
 * Verifies the caller's Bearer token as a locally-signed JWT (via auth-svc's
 * JWKS) and confirms the underlying session is still live via a lightweight
 * auth-svc status check, making the resolved session available to the rest
 * of the request via AuthContext. Apply directly in each consuming app's own
 * AppModule:
 *
 *   providers: [AuthContext, { provide: APP_GUARD, useClass: AuthGuard }]
 *
 * Routes (or whole controllers) decorated with @Public() are skipped.
 * Requires AUTH_SERVICE_URL and INTERNAL_SERVICE_KEY in the app's config
 * (ConfigModule must be registered) and HttpClientModule.forRoot() imported
 * for HttpClientService.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    private jwks: Jwks | undefined;

    constructor(
        private readonly httpClient: HttpClientService,
        private readonly authContext: AuthContext,
        private readonly configService: ConfigService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;

        const req = context.switchToHttp().getRequest<IncomingMessage>();
        const token = this.extractBearerToken(req.headers.authorization);
        const session = token ? await this.resolveSession(token) : undefined;
        if (!session) throw new UnauthorizedException();
        this.authContext.enterWith(session);
        return true;
    }

    private extractBearerToken(header?: string): string | undefined {
        if (!header) return undefined;
        const [scheme, token] = header.split(' ');
        return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
    }

    private async resolveSession(token: string): Promise<AuthSession | undefined> {
        const authServiceUrl = this.configService.getOrThrow<string>(AUTH_SERVICE_URL_ENV_KEY);
        try {
            const claims = await verifyAuthToken(token, this.getJwks(authServiceUrl), authServiceUrl);
            const status = await checkSessionStatus(
                this.httpClient,
                authServiceUrl,
                this.configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY),
                claims.sessionId,
            );
            return this.isSessionValid(status, claims.organizationId) ? this.buildAuthSession(claims) : undefined;
        } catch {
            return undefined;
        }
    }

    private getJwks(authServiceUrl: string): Jwks {
        this.jwks ??= buildRemoteJwks(authServiceUrl);
        return this.jwks;
    }

    private isSessionValid(status: SessionStatus, claimedOrganizationId: string | undefined): boolean {
        return status.active && status.isMember && status.activeOrganizationId === (claimedOrganizationId ?? null);
    }

    private buildAuthSession(claims: JwtClaims): AuthSession {
        return {
            session: {
                id: claims.sessionId,
                userId: claims.userId,
                expiresAt: new Date(claims.exp * 1000),
                activeOrganizationId: claims.organizationId,
            },
            user: {
                id: claims.userId,
                email: claims.email,
                name: claims.name,
                emailVerified: claims.emailVerified,
            },
        };
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx nx run core:test --testFile=auth.guard.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Typecheck the whole package**

Run: `npx nx run core:typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/guard/auth/auth.guard.ts packages/core/src/lib/guard/auth/auth.constants.ts packages/core/src/lib/guard/auth/auth.guard.spec.ts
git commit -m "feat(core): verify AuthGuard tokens locally via JWKS instead of an auth-svc round-trip"
```

---

## Task 6: auth-svc — `jwt()` plugin

**Files:**
- Create: `apps/parishbooks-auth-svc/src/libs/plugins/jwt/jwt.plugin.ts`
- Test: `apps/parishbooks-auth-svc/src/libs/plugins/jwt/jwt.plugin.spec.ts`
- Modify: `apps/parishbooks-auth-svc/src/libs/auth.config.ts`

**Interfaces:**
- Produces: `jwtPlugin(): ReturnType<typeof jwt>` — wired into `betterAuthConfig`'s `plugins` array.

- [ ] **Step 1: Write the failing test**

```ts
import { jwtPlugin } from './jwt.plugin';

describe('jwtPlugin', () => {
    it('registers as the "jwt" better-auth plugin', () => {
        const plugin = jwtPlugin();
        expect(plugin.id).toBe('jwt');
    });

    it('embeds sessionId, userId, email, and organizationId in the JWT payload', () => {
        const plugin = jwtPlugin();
        const definePayload = plugin.options?.jwt?.definePayload;
        expect(definePayload).toBeDefined();

        const payload = definePayload!({
            user: { id: 'user-1', email: 'jane@example.com', name: 'Jane', emailVerified: true },
            session: { id: 'sess-1', activeOrganizationId: 'org-1' },
        } as never);

        expect(payload).toEqual({
            sessionId: 'sess-1',
            userId: 'user-1',
            email: 'jane@example.com',
            name: 'Jane',
            emailVerified: true,
            organizationId: 'org-1',
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx run parishbooks-auth-svc:test --testFile=jwt.plugin.spec.ts`
Expected: FAIL with "Cannot find module './jwt.plugin'".

- [ ] **Step 3: Implement**

```ts
import { jwt } from 'better-auth/plugins';

export const jwtPlugin = () =>
    jwt({
        jwt: {
            expirationTime: '10m',
            definePayload: ({ user, session }) => ({
                sessionId: session.id,
                userId: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
                organizationId: session.activeOrganizationId,
            }),
        },
    });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx run parishbooks-auth-svc:test --testFile=jwt.plugin.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the plugin into `betterAuthConfig`**

In `apps/parishbooks-auth-svc/src/libs/auth.config.ts`, add the import:

```ts
import { jwtPlugin } from './plugins/jwt/jwt.plugin';
```

And add `jwtPlugin()` to the `plugins` array (alongside the existing entries):

```ts
plugins: [organizationPlugin(config, httpClient), emailOtpPlugin(logger), stripePlugin(stripeClient, config, pool, httpClient), jwtPlugin(), bearer()],
```

- [ ] **Step 6: Typecheck**

Run: `npx nx run parishbooks-auth-svc:typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/parishbooks-auth-svc/src/libs/plugins/jwt/jwt.plugin.ts apps/parishbooks-auth-svc/src/libs/plugins/jwt/jwt.plugin.spec.ts apps/parishbooks-auth-svc/src/libs/auth.config.ts
git commit -m "feat(auth-svc): register BetterAuth jwt() plugin with organizationId/sessionId payload"
```

---

## Task 7: auth-svc — session-status module

**Files:**
- Create: `apps/parishbooks-auth-svc/src/app/session-status/session-status.constants.ts`
- Create: `apps/parishbooks-auth-svc/src/app/session-status/session-status.repository.ts`
- Test: `apps/parishbooks-auth-svc/src/app/session-status/session-status.repository.spec.ts`
- Create: `apps/parishbooks-auth-svc/src/app/session-status/session-status.service.ts`
- Create: `apps/parishbooks-auth-svc/src/app/session-status/session-status.controller.ts`
- Test: `apps/parishbooks-auth-svc/src/app/session-status/session-status.controller.spec.ts`
- Create: `apps/parishbooks-auth-svc/src/app/session-status/session-status.module.ts`
- Modify: `apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`
- Modify: `apps/parishbooks-auth-svc/src/app/app.module.ts`

**Interfaces:**
- Consumes: `buildConnectionPool` from `../../utils/auth.utils`; `Public`, `InternalServiceGuard`, `ApiProperty` from `@parishbooks/core`.
- Produces: `GET /api/identity/session/:sessionId/status` → `SessionStatus` shape (`{ active, isMember, activeOrganizationId }`) — consumed by `packages/core`'s `checkSessionStatus` (Task 4/5).

- [ ] **Step 1: DI token for the auth DB pool**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.constants.ts
export const AUTH_DB_POOL = 'AUTH_DB_POOL';
```

- [ ] **Step 2: Write the failing repository test**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.repository.spec.ts
import { Pool } from 'pg';
import { SessionStatusRepository } from './session-status.repository';

describe('SessionStatusRepository#findStatus', () => {
    let pool: { query: jest.Mock };
    let repository: SessionStatusRepository;

    beforeEach(() => {
        pool = { query: jest.fn() };
        repository = new SessionStatusRepository(pool as unknown as Pool);
    });

    it('returns active status with membership when a live session row is found', async () => {
        pool.query.mockResolvedValue({ rows: [{ activeOrganizationId: 'org-1', isMember: true }] });

        const result = await repository.findStatus('sess-1');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM auth.session'), ['sess-1']);
        expect(result).toEqual({ active: true, isMember: true, activeOrganizationId: 'org-1' });
    });

    it('returns inactive when no matching live session row exists', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findStatus('sess-missing');

        expect(result).toEqual({ active: false, isMember: false, activeOrganizationId: null });
    });

    it('returns isMember false when the session has an active org but no matching member row', async () => {
        pool.query.mockResolvedValue({ rows: [{ activeOrganizationId: 'org-1', isMember: false }] });

        const result = await repository.findStatus('sess-1');

        expect(result).toEqual({ active: true, isMember: false, activeOrganizationId: 'org-1' });
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx nx run parishbooks-auth-svc:test --testFile=session-status.repository.spec.ts`
Expected: FAIL with "Cannot find module './session-status.repository'".

- [ ] **Step 4: Implement the repository**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AUTH_DB_POOL } from './session-status.constants';

export interface SessionStatusRow {
    active: boolean;
    isMember: boolean;
    activeOrganizationId: string | null;
}

const SESSION_STATUS_QUERY = `
    SELECT s."activeOrganizationId",
           EXISTS (
               SELECT 1 FROM auth.member m
               WHERE m."organizationId" = s."activeOrganizationId" AND m."userId" = s."userId"
           ) AS "isMember"
    FROM auth.session s
    WHERE s.id = $1 AND s."expiresAt" > now()
`;

@Injectable()
export class SessionStatusRepository {
    constructor(@Inject(AUTH_DB_POOL) private readonly pool: Pool) {}

    async findStatus(sessionId: string): Promise<SessionStatusRow> {
        const result = await this.pool.query<{ activeOrganizationId: string | null; isMember: boolean }>(SESSION_STATUS_QUERY, [sessionId]);
        const row = result.rows[0];
        if (!row) return { active: false, isMember: false, activeOrganizationId: null };
        return { active: true, isMember: row.isMember, activeOrganizationId: row.activeOrganizationId };
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx nx run parishbooks-auth-svc:test --testFile=session-status.repository.spec.ts`
Expected: PASS.

- [ ] **Step 6: Service (thin passthrough — orchestration point for future logic)**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.service.ts
import { Injectable } from '@nestjs/common';
import { SessionStatusRepository, SessionStatusRow } from './session-status.repository';

@Injectable()
export class SessionStatusService {
    constructor(private readonly repository: SessionStatusRepository) {}

    getStatus(sessionId: string): Promise<SessionStatusRow> {
        return this.repository.findStatus(sessionId);
    }
}
```

- [ ] **Step 7: Response DTOs**

In `apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`, add:

```ts
export class GetTokenResponseDto {
    @ApiProperty()
    token!: string;
}

export class SessionStatusResponseDto {
    @ApiProperty()
    active!: boolean;

    @ApiProperty()
    isMember!: boolean;

    @ApiPropertyOptional({ type: String, nullable: true })
    activeOrganizationId!: string | null;
}
```

- [ ] **Step 8: Write the failing controller test**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.controller.spec.ts
import { Test } from '@nestjs/testing';
import { SessionStatusController } from './session-status.controller';
import { SessionStatusService } from './session-status.service';

describe('SessionStatusController', () => {
    let controller: SessionStatusController;
    let service: { getStatus: jest.Mock };

    beforeEach(async () => {
        service = { getStatus: jest.fn() };
        const module = await Test.createTestingModule({
            controllers: [SessionStatusController],
            providers: [{ provide: SessionStatusService, useValue: service }],
        }).compile();

        controller = module.get(SessionStatusController);
    });

    it('delegates to the service with the sessionId path param', async () => {
        service.getStatus.mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' });

        const result = await controller.getStatus('sess-1');

        expect(service.getStatus).toHaveBeenCalledWith('sess-1');
        expect(result).toEqual({ active: true, isMember: true, activeOrganizationId: 'org-1' });
    });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npx nx run parishbooks-auth-svc:test --testFile=session-status.controller.spec.ts`
Expected: FAIL with "Cannot find module './session-status.controller'".

- [ ] **Step 10: Implement the controller**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.controller.ts
import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, InternalServiceGuard, Public } from '@parishbooks/core';
import { SessionStatusResponseDto } from '../dto/response.dto';
import { SessionStatusService } from './session-status.service';

@ApiTags('identity')
@Controller('identity/session')
export class SessionStatusController {
    constructor(private readonly service: SessionStatusService) {}

    @ApiProperty({ name: 'getSessionStatus', status: HttpStatus.OK, responseType: SessionStatusResponseDto })
    @ApiParam({ name: 'sessionId', description: 'BetterAuth session id' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Get(':sessionId/status')
    getStatus(@Param('sessionId') sessionId: string) {
        return this.service.getStatus(sessionId);
    }
}
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx nx run parishbooks-auth-svc:test --testFile=session-status.controller.spec.ts`
Expected: PASS.

- [ ] **Step 12: Module, reusing `buildConnectionPool`**

```ts
// apps/parishbooks-auth-svc/src/app/session-status/session-status.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildConnectionPool } from '../../utils/auth.utils';
import { AUTH_DB_POOL } from './session-status.constants';
import { SessionStatusController } from './session-status.controller';
import { SessionStatusRepository } from './session-status.repository';
import { SessionStatusService } from './session-status.service';

@Module({
    imports: [ConfigModule],
    controllers: [SessionStatusController],
    providers: [
        SessionStatusService,
        SessionStatusRepository,
        {
            provide: AUTH_DB_POOL,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => buildConnectionPool(configService.getOrThrow('DATABASE_URL')),
        },
    ],
})
export class SessionStatusModule {}
```

- [ ] **Step 13: Wire into `AppModule`**

In `apps/parishbooks-auth-svc/src/app/app.module.ts`, add the import:

```ts
import { SessionStatusModule } from './session-status/session-status.module';
```

And add `SessionStatusModule` to the `imports` array (alongside `AuthModule.forRootAsync({...})`).

- [ ] **Step 14: Typecheck and run all auth-svc tests**

Run: `npx nx run parishbooks-auth-svc:typecheck && npx nx run parishbooks-auth-svc:test`
Expected: both PASS.

- [ ] **Step 15: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/session-status apps/parishbooks-auth-svc/src/app/dto/response.dto.ts apps/parishbooks-auth-svc/src/app/app.module.ts
git commit -m "feat(auth-svc): add internal session-status endpoint for AuthGuard revocation checks"
```

---

## Task 8: auth-svc — DTO for the re-minted token on org switch

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`

**Interfaces:**
- Produces: `OrganizationWithRelationsDto.token: string` — consumed by Task 9's `setActiveOrganization`.

- [ ] **Step 1: Add the `token` field**

In `apps/parishbooks-auth-svc/src/app/dto/response.dto.ts`, find:

```ts
export class OrganizationWithRelationsDto extends OrganizationDto {
    @ApiProperty({ type: [MemberDto] })
    members!: MemberDto[];

    @ApiProperty({ type: [InvitationDto] })
    invitations!: InvitationDto[];
}
```

Replace with:

```ts
export class OrganizationWithRelationsDto extends OrganizationDto {
    @ApiProperty({ type: [MemberDto] })
    members!: MemberDto[];

    @ApiProperty({ type: [InvitationDto] })
    invitations!: InvitationDto[];

    @ApiProperty({ description: 'Freshly minted JWT reflecting this organization as the active one' })
    token!: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx nx run parishbooks-auth-svc:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/dto/response.dto.ts
git commit -m "feat(auth-svc): add token field to OrganizationWithRelationsDto for org-switch re-mint"
```

---

## Task 9: auth-svc — `AppService` JWT minting

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/app/app.service.ts`
- Modify: `apps/parishbooks-auth-svc/src/app/app.service.spec.ts` (extend — Task 1 already made this file's baseline green)

**Interfaces:**
- Consumes: `authService.api.getToken({ headers }): Promise<{ token: string }>` (available once Task 6 registers the `jwt()` plugin, since `AuthService<typeof auth>` is generic over the composed plugin set).
- Produces: `AppService.getToken(headers: Headers): Promise<{ token: string }>` — consumed by Task 10's controller endpoint. `signIn`, `signUp`, `setActiveOrganization` response shapes gain/overwrite a `token` field as described in spec §4.

- [ ] **Step 1: Write the failing tests**

Append to `apps/parishbooks-auth-svc/src/app/app.service.spec.ts` (after the existing `describe('AppService#createOrganization', ...)` block — keep both blocks in the same file, they share the same `jest.mock('../auth', ...)` at the top):

```ts
describe('AppService — JWT minting', () => {
    let service: AppService;
    let authService: { api: Record<string, jest.Mock> };

    beforeEach(async () => {
        authService = {
            api: {
                signInEmail: jest.fn(),
                signUpEmail: jest.fn(),
                setActiveOrganization: jest.fn(),
                getToken: jest.fn(),
            },
        };

        const module = await Test.createTestingModule({
            providers: [AppService, { provide: AuthService, useValue: authService }],
        }).compile();

        service = module.get(AppService);
    });

    it('signIn mints a JWT from the freshly established session and overwrites the response token', async () => {
        authService.api.signInEmail.mockResolvedValue({ redirect: false, token: 'opaque-session-token', user: { id: 'user-1' } });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.signIn({ email: 'jane@example.com', password: 'super-secret' });

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders.get('authorization')).toBe('Bearer opaque-session-token');
        expect(result).toEqual({ redirect: false, token: 'jwt-token', user: { id: 'user-1' } });
    });

    it('signUp mints a JWT when sign-up returns a session token', async () => {
        authService.api.signUpEmail.mockResolvedValue({ token: 'opaque-session-token', user: { id: 'user-1' } });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.signUp({ name: 'Jane', email: 'jane@example.com', password: 'super-secret' });

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders.get('authorization')).toBe('Bearer opaque-session-token');
        expect(result).toEqual({ token: 'jwt-token', user: { id: 'user-1' } });
    });

    it('signUp skips minting when no session is established (email verification required)', async () => {
        authService.api.signUpEmail.mockResolvedValue({ token: null, user: { id: 'user-1' } });

        const result = await service.signUp({ name: 'Jane', email: 'jane@example.com', password: 'super-secret' });

        expect(authService.api.getToken).not.toHaveBeenCalled();
        expect(result).toEqual({ token: null, user: { id: 'user-1' } });
    });

    it('setActiveOrganization re-mints a JWT reflecting the newly active organization', async () => {
        const headers = new Headers({ authorization: 'Bearer jwt-token' });
        authService.api.setActiveOrganization.mockResolvedValue({ id: 'org-1', name: 'St. Mary Parish' });
        authService.api.getToken.mockResolvedValue({ token: 'new-jwt-token' });

        const result = await service.setActiveOrganization({ organizationId: 'org-1' }, headers);

        const [[{ headers: mintHeaders }]] = authService.api.getToken.mock.calls;
        expect(mintHeaders).toBe(headers);
        expect(result).toEqual({ id: 'org-1', name: 'St. Mary Parish', token: 'new-jwt-token' });
    });

    it('getToken delegates to the better-auth token endpoint with the caller headers', async () => {
        const headers = new Headers({ cookie: 'better-auth.session=abc' });
        authService.api.getToken.mockResolvedValue({ token: 'jwt-token' });

        const result = await service.getToken(headers);

        expect(authService.api.getToken).toHaveBeenCalledWith({ headers });
        expect(result).toEqual({ token: 'jwt-token' });
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run parishbooks-auth-svc:test --testFile=app.service.spec.ts`
Expected: FAIL — `signIn`/`signUp`/`setActiveOrganization` return the unminted opaque token (or `undefined` for `getToken`, which doesn't exist yet).

- [ ] **Step 3: Implement the minting helpers and update the three methods**

In `apps/parishbooks-auth-svc/src/app/app.service.ts`, replace `signUp`, `signIn`, and `setActiveOrganization`, and add `getToken`. `signUp` must skip minting when `token` comes back `null` (email verification pending); `signIn` never has a null token:

```ts
async signUp(dto: SignUpDto) {
    const result = await this.authService.api.signUpEmail({ body: { ...dto } });
    if (!result.token) return result;
    const token = await this.mintToken(this.bearerHeaders(result.token));
    return { ...result, token };
}

async signIn(dto: SignInDto) {
    const result = await this.authService.api.signInEmail({ body: { ...dto } });
    const token = await this.mintToken(this.bearerHeaders(result.token));
    return { ...result, token };
}
```

And replace `setActiveOrganization`:

```ts
async setActiveOrganization(dto: SetActiveOrganizationDto, headers: Headers) {
    const org = await this.authService.api.setActiveOrganization({ body: { ...dto }, headers });
    const token = await this.mintToken(headers);
    return { ...org, token };
}
```

Add the new `getToken` method (place it near `setActiveOrganization`):

```ts
getToken(headers: Headers): Promise<{ token: string }> {
    return this.authService.api.getToken({ headers });
}
```

Add the two small private helpers at the bottom of the class (single responsibility each, per the no-god-function rule):

```ts
private bearerHeaders(token: string): Headers {
    return new Headers({ authorization: `Bearer ${token}` });
}

private async mintToken(headers: Headers): Promise<string> {
    const { token } = await this.authService.api.getToken({ headers });
    return token;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run parishbooks-auth-svc:test --testFile=app.service.spec.ts`
Expected: PASS (all tests in both `describe` blocks).

- [ ] **Step 5: Typecheck**

Run: `npx nx run parishbooks-auth-svc:typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/app.service.ts apps/parishbooks-auth-svc/src/app/app.service.spec.ts
git commit -m "feat(auth-svc): mint JWTs on sign-in, sign-up, and org switch"
```

---

## Task 10: auth-svc — `GET /identity/token` endpoint

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/app/app.controller.ts`

**Interfaces:**
- Consumes: `AppService.getToken(headers)` (Task 9), `GetTokenResponseDto` (Task 7).
- Produces: `GET /api/identity/token` — used by the client after the Google OAuth callback and for periodic JWT refresh (spec §4, §7).

- [ ] **Step 1: Add the import**

In `apps/parishbooks-auth-svc/src/app/app.controller.ts`, add `GetTokenResponseDto` to the existing destructured import from `./dto/response.dto`:

```ts
import {
    AcceptInvitationResponseDto,
    ChangePasswordResponseDto,
    GetSessionResponseDto,
    GetTokenResponseDto,
    GoogleSignInResponseDto,
    InvitationDto,
    ListMembersResponseDto,
    OrganizationDto,
    OrganizationWithRelationsDto,
    RequestPasswordResetResponseDto,
    SignInResponseDto,
    SignOutResponseDto,
    SignUpResponseDto,
    StatusResponseDto,
} from './dto/response.dto';
```

- [ ] **Step 2: Add the endpoint**

Immediately after the existing `getSession` method:

```ts
@ApiProperty({ name: 'getSession', status: HttpStatus.OK, responseType: GetSessionResponseDto })
@Get('session')
getSession(@Session() session: UserSession<typeof auth>) {
    return session;
}

@ApiProperty({ name: 'getToken', status: HttpStatus.OK, responseType: GetTokenResponseDto })
@Get('token')
getToken(@Req() req: IncomingMessage) {
    return this.appService.getToken(fromNodeHeaders(req.headers));
}
```

(`fromNodeHeaders` and `IncomingMessage` are already imported at the top of this file for `signOut`.)

- [ ] **Step 3: Typecheck**

Run: `npx nx run parishbooks-auth-svc:typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke check (no controller spec exists for `AppController` today — matches its current test coverage, which is none)**

Run: `npx nx run parishbooks-auth-svc:serve`, then in another terminal:

```bash
curl -s -X POST http://localhost:8001/api/identity/sign-up \
  -H 'content-type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"super-secret-1"}'
```

Expected: a JSON response with a `token` field. If `requireEmailVerification` gates it to `null` (per current config), sign in instead:

```bash
curl -s -X POST http://localhost:8001/api/identity/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"jane@example.com","password":"super-secret-1"}'
```

Expected: `token` is a JWT (three dot-separated base64url segments), not the old opaque session string. Then:

```bash
curl -s http://localhost:8001/api/identity/token -H "Authorization: Bearer <token from above>"
```

Expected: `{"token": "<a JWT>"}`.

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/app.controller.ts
git commit -m "feat(auth-svc): add GET /identity/token for OAuth-callback and JWT refresh"
```

---

## Task 11: Full verification across all affected projects

**Files:** none (verification only)

- [ ] **Step 1: Typecheck every service that consumes `AuthGuard`**

Run:

```bash
npx nx run-many -t typecheck -p parishbooks-auth-svc,parishbooks-gateway-svc,parishbooks-org-svc,parishbooks-billing-svc,parishbooks-crm-svc,parishbooks-giving-svc,parishbooks-ledger-svc,core
```

Expected: all PASS. `AuthGuard`'s constructor signature and public `canActivate` are unchanged, so none of these six services should need any code edits — this step exists to confirm that, not to fix anything new.

- [ ] **Step 2: Run the full affected test suite**

Run: `npx nx affected -t test`
Expected: PASS.

- [ ] **Step 3: Lint the affected projects**

Run: `npx nx affected -t lint`
Expected: PASS.

- [ ] **Step 4: Confirm no lingering references to the removed session-path constants**

Run: `grep -rn "AUTH_SESSION_PATH\|DEFAULT_SESSION_PATH" packages apps --include="*.ts"`
Expected: no matches (both were removed in Task 5 and had exactly one consumer, the old `AuthGuard`).

- [ ] **Step 5: Note the required environment variables for rollout**

Not a code change — record this so it isn't missed when deploying: `gateway-svc`, `org-svc`, `billing-svc`, `crm-svc`, `giving-svc`, and `ledger-svc` each need `INTERNAL_SERVICE_KEY` set to the same shared secret auth-svc already uses (they already have `AUTH_SERVICE_URL`, reused for both the JWKS URL and the status-check URL). Without it, `AuthGuard`'s call to `checkSessionStatus` will fail closed (every request 401s) the moment this deploys.

- [ ] **Step 6: Final commit (if step 4's grep or any cleanup produced changes; otherwise skip)**

```bash
git status
```

If clean, no commit needed — the plan is complete as of Task 10's commit.
