# Auth Service — Identity Abstraction Endpoints

> Design for `AppController`/`AppService` in `apps/parishbooks-auth-svc`: the
> curated HTTP surface other ParishBooks microservices (via the gateway) use
> to talk to BetterAuth, instead of calling BetterAuth's own generated routes
> directly.

## Table of Contents

1. Routing Split
2. Config & Plugin Changes
3. Session Strategy: Bearer Token
4. Endpoint Table
5. File Layout

## 1. Routing Split

BetterAuth (via `@thallesp/nestjs-better-auth`) auto-mounts its full raw
endpoint surface at `/api/auth/*` (default `basePath`). That mount is left
enabled — its only remaining job is the Google OAuth redirect/callback dance,
which requires real browser navigation and can't be JSON-wrapped by a service
controller.

`AppController` is mounted separately at `/api/identity/*` (`@Controller('identity')`).
This is the only auth surface other services/the gateway should call —
distinct prefix so the two surfaces never collide on path.

## 2. Config & Plugin Changes

- `libs/auth.config.ts`: add `organization()` and `bearer()` to BetterAuth's
  `plugins` array; add `socialProviders.google` using
  `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET`.
- `types/auth.types.ts`: extend `BetterAuthConfig` with `googleClientId` /
  `googleClientSecret`.
- `app.module.ts`: read the two new env vars via `ConfigService.getOrThrow`
  and pass them into `betterAuthConfig`.
- `.env`: add placeholders for the two new vars.
- `main.ts`: add the global `ValidationPipe` (`whitelist`,
  `forbidNonWhitelisted`, `transform`) per
  `docs/architecture/api-conventions-error-handling.md` — this was still the
  unmodified Nx scaffold and had no validation pipe wired up.
- `AuthModule.forRootAsync` keeps `disableControllers` unset (default:
  enabled) — BetterAuth's own controllers stay mounted, per §1.

## 3. Session Strategy: Bearer Token

Per `docs/architecture/microservices-http.md` §2, the gateway forwards "the
original Bearer token" downstream. The `bearer()` plugin makes BetterAuth
accept `Authorization: Bearer <session-token>` as equivalent to its session
cookie. `sign-up`/`sign-in` responses return that token in the JSON body;
callers store and forward it themselves. No `@Res()`/cookie-forwarding code
is needed anywhere in `AppController`.

Protected routes rely on `@thallesp/nestjs-better-auth`'s global `AuthGuard`
(enabled by default unless `disableGlobalAuthGuard` is set, which it isn't).
Public routes are marked `@AllowAnonymous()`. `@Session()` extracts the
already-validated session/user for protected handlers.

## 4. Endpoint Table

| Method & Path | Auth | Purpose |
|---|---|---|
| POST /identity/sign-up | public | email+password registration |
| POST /identity/sign-in | public | email+password login, returns token |
| POST /identity/google/sign-in | public | returns `{ url }` for the browser to navigate to `/api/auth/callback/google` |
| POST /identity/sign-out | session | invalidate current session |
| GET /identity/session | session | current user/session |
| POST /identity/verify-email | public | consume verification token |
| POST /identity/resend-verification-email | public | resend verification link |
| POST /identity/forgot-password | public | request reset email |
| POST /identity/reset-password | public | consume reset token |
| POST /identity/change-password | session | authenticated password change |
| PATCH /identity/profile | session | update name/image |
| POST /identity/organizations | session | create organization |
| GET /identity/organizations | session | list caller's organizations |
| POST /identity/organizations/active | session | set `activeOrganizationId` |
| POST /identity/organizations/:organizationId/invitations | session | invite member by email |
| POST /identity/organizations/invitations/:invitationId/accept | session | accept invitation |
| GET /identity/organizations/:organizationId/members | session | list members |

## 5. File Layout

```
apps/parishbooks-auth-svc/src/app/
  app.controller.ts        # routing + validation only
  app.service.ts           # wraps authService.api.*, only place touching BetterAuth
  app.module.ts             # + google env vars
  dto/
    email-auth.dto.ts       # sign-up, sign-in, forgot/reset-password, verify-email, change-password, profile
    google-auth.dto.ts       # google sign-in
    organization.dto.ts      # create org, set active, invite, accept, list members
```

`AppService` is the sole caller of `authService.api.*`; `AppController` never
calls BetterAuth directly. Each service method takes plain DTO/session
arguments and returns BetterAuth's typed response as-is (no reshaping) —
BetterAuth's response shapes already satisfy the "typed JSON" requirement,
so an extra mapping layer would be pure overhead.
