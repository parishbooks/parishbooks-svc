# Back-office ↔ services wiring

The UI lives in **`parishbooks-backoffice`** (sibling repo). Browser code does
not call Nest service ports directly.

## Local stack

```bash
# parishbooks-svc
docker compose up -d postgres kong
cp .env.example .env
bun nx run-many -t serve -p parishbooks-auth-svc,parishbooks-org-svc

# parishbooks-backoffice
cp .env.example .env.local
bun dev
```

| Process | URL |
| ------- | --- |
| Kong | `http://localhost:8000` |
| Back-office | `http://localhost:3000` |

Server actions call Kong via the generated SDK (`API_BASE_URL`, default
`http://localhost:8000/api`) with `Authorization: Bearer <JWT>` from the
httpOnly session cookie. Each service's `AuthGuard` verifies the JWT.

## Environment

| Variable | Repo | Purpose |
| -------- | ---- | ------- |
| `API_BASE_URL` | back-office | Kong `/api` prefix for server-side SDK calls |
| `AUTH_SERVICE_URL` | svc | `AuthGuard` JWKS + session status |
| `INTERNAL_SERVICE_KEY` | svc | Service-to-service auth |

Sign-in and session flows use `/api/identity/*` on Kong. OAuth browser
redirects use `/api/auth/*` (Kong → auth-svc).
