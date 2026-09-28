# Back-office ↔ services wiring

The UI lives in **`parishbooks-backoffice`** (sibling repo). It never calls
Nest ports directly.

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
| Browser API | `http://localhost:3000/api/*` → BFF → Kong → `*-svc` |

## Environment

| Variable | Repo | Purpose |
| -------- | ---- | ------- |
| `KONG_PROXY_URL` | both | BFF upstream (back-office) |
| `AUTH_SERVICE_URL` | both | JWKS + JWT issuer resolution in BFF |
| `AUTH_SERVICE_URL` | svc | `AuthGuard` session status checks |
| `INTERNAL_SERVICE_KEY` | svc | Service-to-service auth |

Sign-in and session flows use `/api/identity/*` on the BFF, which proxies to
Kong and then `auth-svc`. OAuth browser redirects use `/api/auth/*` (Kong →
auth-svc) — configure Google redirect URLs accordingly.
