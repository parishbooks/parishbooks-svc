# Kong — Route Map

> Declarative routing for local and deployed environments. Source of truth:
> `infra/kong/kong.yml`.

## Public listener

| Route | Paths | Upstream | Notes |
| ----- | ----- | -------- | ----- |
| `better-auth` | `/api/auth` | `auth-svc` | OAuth, JWKS, Stripe webhook under Better Auth |
| `auth-identity` | `/api/identity` | `auth-svc` | Curated identity API (`AppController`) |
| `org-api` | `/api/organizations` | `org-svc` | Profiles, onboarding, Cashfree vendor KYC webhook |
| `member-api` | `/api/member` | `member-svc` | Reserved for CRM phase |
| `giving-api` | `/api/giving` | `giving-svc` | Donations, payment webhooks (Phase 1) |
| `ledger-api` | `/api/ledger` | `ledger-svc` | Journal posting |
| `billing-api` | `/api/billing` | `billing-svc` | Deferred Phase 1 |
| `events-api` | `/api/events` | `events-svc` | Out of Phase 1 scope |

Back-office UI is **not** served by Kong in local dev (Next.js on `:3000`).
In production, Kong may also route `/` to the back-office static/server
deployment.

## Internal-only

| Path | Upstream | Guard |
| ---- | -------- | ----- |
| `/api/identity/session/:id/status` | `auth-svc` | `InternalServiceGuard` — not exposed on the public listener in production |

## Local ports

| Service | Default port |
| ------- | ------------- |
| Kong proxy | `8000` (replaces the former gateway port) |
| Kong admin API | `8009` (local compose only) |
| `auth-svc` | `8001` |
| `org-svc` | `8007` |
| Other `*-svc` | See root `.env` |

When running Kong in Docker, upstream URLs use `host.docker.internal` so
containers reach Nest processes on the host.

## Back-office BFF

The Next.js app in `parishbooks-backoffice` proxies `/api/*` to
`KONG_PROXY_URL` (default `http://localhost:8000`). The browser never
calls service ports directly.
