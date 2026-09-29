# ParishBooks Services

Backend monorepo for [ParishBooks](https://github.com/parishbooks/parishbooks-svc): a multi-tenant church management and financial platform. Each tenant is an **organization** (a church). The system combines congregant giving, double-entry accounting, CRM-style member data, and (in later phases) SaaS billing for churches using the product.

Compliance is **India-first** for launch: 80G tax receipts, PAN capture, and FCRA fund segregation. US 501(c)(3) support is planned as a later addendum ([docs/compliance/tax-receipts-80g-501c3.md](docs/compliance/tax-receipts-80g-501c3.md)).

**Phase 1** focuses on **Giving** only: a congregant gives tithes and offerings, the church receives funds via Cashfree Easy Split, and the donor gets a correct 80G receipt. CRM, ledger reporting UI, and subscription billing for churches are sequenced after Giving is live. See [docs/roadmap.md](docs/roadmap.md) for scope and service build state.

Related repositories (not in this monorepo):

- **Back-office** — Next.js App Router (`parishbooks-backoffice`); UI talks to services through a `/api` BFF and Kong, not directly to Nest ports.
- **Congregant app** — React Native + Expo for mobile giving and history.

## Stack

| Layer | Technology |
| --- | --- |
| Monorepo | [Nx](https://nx.dev) 23.x, package manager [Bun](https://bun.sh) |
| Services | NestJS 11, REST/JSON over HTTP (no message broker) |
| Auth & tenants | [Better Auth](https://www.better-auth.com/) in `parishbooks-auth-svc` |
| Database | PostgreSQL 16, TypeORM (entities, repositories, migrations only — no `synchronize`) |
| Giving payments | Cashfree PG + Easy Split |
| SaaS billing (later) | Stripe + Cashfree Subscriptions |
| Edge routing | Kong (declarative config in [infra/kong/](infra/kong/)) |

## Repository layout

```
apps/
  parishbooks-auth-svc/      # Sessions, OTP, JWT, org switching
  parishbooks-org-svc/       # Church profile, onboarding, Cashfree vendor KYC
  parishbooks-giving-svc/    # Donations, Cashfree orders, webhooks
  parishbooks-ledger-svc/    # Append-only double-entry posting
  parishbooks-member-svc/    # CRM (post–Phase 1)
  parishbooks-billing-svc/   # Church SaaS billing (post–Phase 1)
  parishbooks-events-svc/    # Events (future)
packages/
  database/                  # Entities, migrations, TypeORM data source
  core/                      # Auth guard, HTTP client, Swagger, logging
  config/                    # Shared configuration helpers
  messaging/                 # Email (and future SMS)
  e2e-supertest/             # In-process Supertest E2E helpers
docs/                        # Architecture, specs, integrations, compliance
infra/kong/                  # Kong routes to services
```

Operational rules for contributors and agents live in [CLAUDE.md](CLAUDE.md). Deep dives are under [docs/](docs/).

## Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com/) (PostgreSQL and Kong for local dev)

## Local setup

```bash
bun install
cp .env.example .env   # fill in secrets and service ports
docker compose up -d postgres kong
bun run typeorm:migrate
```

Kong proxies north–south traffic on `http://localhost:8000`. Postgres listens on `5432` with database `parishbooks` (see [docker-compose.yml](docker-compose.yml)).

Full walkthrough: [docs/dx/getting-started.md](docs/dx/getting-started.md).

## Running services

```bash
bunx nx serve parishbooks-auth-svc
bunx nx run-many -t serve -p parishbooks-auth-svc,parishbooks-org-svc
bun run dev   # serve all apps (when you want the full local stack)
```

To run the back-office against this stack: set `API_BASE_URL=http://localhost:8000/api` in the back-office repo and start Kong plus the Nest services you need. See [docs/architecture/kong-routing.md](docs/architecture/kong-routing.md).

## Tests and CI-style checks

```bash
bunx nx affected -t lint test build
bun run test:e2e
```

Prefer `nx affected` over running every project as the workspace grows.

## Scaffolding

New HTTP services use the `parishbooks-<domain>-svc` naming convention:

```bash
bunx nx g @nx/nest:app parishbooks-example-svc
bunx nx g @nx/js:lib example --directory=packages/example
```

Shared code belongs in `packages/`, not duplicated across apps. See [docs/architecture/monorepo-structure.md](docs/architecture/monorepo-structure.md).

## Documentation map

| Topic | Location |
| --- | --- |
| Getting started | [docs/dx/getting-started.md](docs/dx/getting-started.md) |
| Phase 1 scope & service status | [docs/roadmap.md](docs/roadmap.md) |
| Multi-tenancy & Better Auth | [docs/architecture/multi-tenancy-betterauth.md](docs/architecture/multi-tenancy-betterauth.md) |
| Service HTTP & headers | [docs/architecture/microservices-http.md](docs/architecture/microservices-http.md) |
| Database schema | [docs/specs/typeorm-database-schema.md](docs/specs/typeorm-database-schema.md) |
| Ledger invariants | [docs/specs/double-entry-ledger.md](docs/specs/double-entry-ledger.md) |
| Cashfree giving | [docs/integrations/cashfree-giving-split.md](docs/integrations/cashfree-giving-split.md) |
| Testing | [docs/quality-ops/testing-strategy.md](docs/quality-ops/testing-strategy.md) |

## License

MIT (see [package.json](package.json)).
