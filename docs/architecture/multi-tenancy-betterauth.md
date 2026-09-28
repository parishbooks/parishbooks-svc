# Multi-Tenancy & BetterAuth

> BetterAuth integration inside `parishbooks-auth-svc`, tenant context resolution, and TypeORM repository scoping.

## Table of Contents

1. BetterAuth Session & Organization Schema
2. Organization Switching Flow
3. Request-Scoped Tenant Context
4. TypeORM Repository Auto-Scoping Pattern
5. Body-Parser Override Rationale

## 1. BetterAuth Session & Organization Schema

BetterAuth is mounted only inside `apps/parishbooks-auth-svc`. It provides:

- **Core plugin** — `user`, `session`, `account` (credential/OAuth links), `verification`.
- **Organization plugin** — `organization`, `member` (user↔organization role), `invitation`.
  The organization plugin extends `session` with an `activeOrganizationId` column.

### Architecture decision: custom TypeORM adapter, not a second database

BetterAuth ships first-party adapters for Prisma, Drizzle, Kysely, and
MongoDB — **not TypeORM**. Two options exist:

| Option                                                                                             | Verdict                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run BetterAuth on its own Prisma-managed schema, separate from the TypeORM-managed business schema | **Rejected.** Two migration tools on one database means "migrations only, never `synchronize`" (CLAUDE.md rule 3) has to be enforced twice, and we lose the ability to open one transaction that creates an `organization` row and seeds its default chart-of-accounts / `OrganizationProfile` row atomically. |
| Implement a custom BetterAuth `Adapter` backed by our existing TypeORM `DataSource`                | **Chosen.** Lives at `libs/shared/betterauth-typeorm-adapter`. BetterAuth's tables become ordinary TypeORM entities, generated through the same `typeorm migration:generate` flow as everything else.                                                                                                          |

`organization`, `member`, `invitation`, `session`, `user`, `account`, and
`verification` are therefore real TypeORM entities, migrated the normal
way. Business-domain tables that need organization-specific fields (e.g.
`fcraRegistered`, `planTier`, `country`) do **not** modify the
BetterAuth-owned `organization` table — they live in a 1:1
`OrganizationProfile` entity with a real FK to `organization.id` (see
`docs/specs/typeorm-database-schema.md`). This keeps BetterAuth's schema
upgrade path (future BetterAuth versions may alter its own tables)
decoupled from ParishBooks' own columns.

## 2. Organization Switching Flow

1. User authenticates once (BetterAuth session cookie/bearer token is not
   tenant-specific — a user can belong to multiple `organization`s via
   `member` rows).
2. Back-office/mobile client calls BetterAuth's built-in
   `authClient.organization.setActive({ organizationId })`.
3. BetterAuth verifies a `member` row exists for
   `(session.userId, organizationId)` and writes `activeOrganizationId`
   onto the session record.
4. All subsequent requests carry the session token; `activeOrganizationId`
   is what downstream services treat as "the tenant."

The org switcher UI only lists organizations returned by
`authClient.organization.list()` (i.e. backed by the user's own `member`
rows) — never accept a client-supplied organization id as ground truth for
which orgs a user may switch into.

## 3. Request-Scoped Tenant Context

- The API Gateway resolves the session on every inbound request, reads
  `activeOrganizationId`, and forwards it downstream as the `x-tenant-id`
  header alongside the original Bearer token (see
  `docs/architecture/microservices-http.md`).
- Each downstream NestJS service runs a `TenantContextMiddleware`
  (`libs/shared/guards/tenant-context.ts`) that stores `organizationId` in
  Node's `AsyncLocalStorage` for the duration of the request. This is what
  lets repositories auto-scope (§4) without threading `organizationId`
  through every method signature by hand.
- `TenantGuard` (`libs/shared/guards`) rejects any request that is missing
  `x-tenant-id`, and — for requests carrying a user Bearer token — verifies
  the token's session actually has that organization as its
  `activeOrganizationId` (or a valid `member` row, for service calls that
  pass a user JWT without going through Kong and `AuthGuard`).
  This prevents a compromised or buggy service from forging a different
  tenant's `x-tenant-id`.
- Pure service-to-service calls (no end-user token — e.g. a scheduled job)
  use an internal service credential instead of a user Bearer token, per
  CLAUDE.md rule 4; `TenantGuard` accepts that credential type separately
  and still requires an explicit `x-tenant-id`.

## 4. TypeORM Repository Auto-Scoping Pattern

- Every tenant-owned entity extends a `TenantEntity` base class
  (`libs/shared/typeorm`) that declares `organizationId: string` and the
  `@Index(['organizationId', 'id'])` convention (see
  `docs/specs/typeorm-database-schema.md`).
- Services inject `TenantScopedRepository<T>` (wraps TypeORM's
  `Repository<T>`), never the raw `Repository<T>`, for any tenant-owned
  entity. The wrapper reads `organizationId` out of `AsyncLocalStorage`
  and:
    - injects it into every `find`/`findOne`/`count` `where` clause,
    - sets it automatically on `create`/`save` for new rows,
    - throws `TenantContextMissingError` if called outside a request context
      (e.g. from a badly-written script) rather than silently querying
      cross-tenant.
- A lint rule / code-review checklist item bans direct injection of
  `@InjectRepository(Member)` (etc.) in favor of the tenant-scoped
  wrapper. BetterAuth's own entities (`organization`, `member`,
  `session`, ...) are the one exception — they're intentionally queried
  without tenant scoping, since resolving _which_ tenant a session
  belongs to is what they're for.

## 5. Body-Parser Override Rationale

BetterAuth mounts its own request handler at `/api/auth/*` and parses the
raw request itself (needed for OAuth callback bodies, CSRF double-submit
checks, and its own content-type handling). Nest's default global body
parser would consume the stream first and leave BetterAuth's handler with
nothing to read, breaking sign-in/callback routes.

Pattern used in `apps/parishbooks-auth-svc/src/main.ts`:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // disable Nest's global body parser
});

// Mount BetterAuth's own handler first, before any JSON body parsing.
app.use('/api/auth/*', toNodeHandler(betterAuth));

// Apply JSON parsing explicitly to every other route.
app.use(express.json());
```

Any future route added to `parishbooks-auth-svc` outside `/api/auth/*`
must confirm `express.json()` still runs ahead of it — this is the one
service where the parser isn't wired up by Nest automatically.
