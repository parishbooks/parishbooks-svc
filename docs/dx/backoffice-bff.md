# Back-office ↔ services wiring

The UI lives in **`parishbooks-backoffice`** (sibling repo). Browser code does
not call Nest service ports directly.

## Local stack

```bash
# parishbooks-svc
docker compose up -d postgres kong
cp .env.example .env
bun nx run-many -t serve -p parishbooks-auth-svc,parishbooks-org-svc

# parishbooks-backoffice (branch feat/kong-bff-gateway-removal or later)
cp .env.example .env.local
bun dev
```

| Process | URL |
| ------- | --- |
| Kong | `http://localhost:8000` |
| Back-office | `http://localhost:3000` |

Server actions call **`KONG_PROXY_URL/api/*`** via `createApiClient()`, which
adds `x-session-token` and `x-tenant-id` from the session JWT before requests
reach Kong.

## Environment

| Variable | Repo | Purpose |
| -------- | ---- | ------- |
| `KONG_PROXY_URL` | back-office | Axios base URL → Kong |
| `AUTH_SERVICE_URL` | back-office | JWKS fetch for JWT verification in `lib/bff` |
| `BETTER_AUTH_URL` | back-office | Must match auth-svc JWT `iss` / `aud` |
| `AUTH_SERVICE_URL` | svc | `AuthGuard` session status checks |
| `INTERNAL_SERVICE_KEY` | svc | Service-to-service auth |

Sign-in and session flows use `/api/identity/*` on Kong (via the server client).
OAuth browser redirects use `/api/auth/*` (Kong → auth-svc) — configure Google
redirect URLs accordingly.
