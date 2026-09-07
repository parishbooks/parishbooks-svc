# OrganizationProfile — Entity, org-svc API, and auth-svc Integration

> Design for the first business-owned data an Organization carries beyond
> what BetterAuth stores: compliance, plan tier, and locale fields, owned
> and served by `parishbooks-org-svc`, written when auth-svc creates an
> organization.

## Table of Contents

1. Context
2. Entity: `OrganizationProfile`
3. org-svc: Module & API
4. auth-svc Integration
5. Error Handling & Known Limitation
6. Testing

## 1. Context

BetterAuth's `organization` plugin (running inside `parishbooks-auth-svc`)
owns identity/membership concerns for an Organization: `id`, `name`,
`slug`, membership, invitations. It has no concept of the business and
compliance data ParishBooks needs per organization — country, FCRA
registration status, subscription plan tier, timezone/currency, and the
80G-related registration numbers required for India tax receipts
(`docs/compliance/tax-receipts-80g-501c3.md`).

`docs/specs/typeorm-database-schema.md` already documents an
`OrganizationProfile` table for this, as a 1:1 extension of BetterAuth's
`organization`, created inside a single shared-database transaction. This
design deliberately departs from that: per the standing decision that
auth-svc stays a thin BetterAuth wrapper and all business APIs live in
their own services, `OrganizationProfile` is owned and served by
`parishbooks-org-svc` over HTTP, not written directly by auth-svc even
though today both services happen to share one Postgres instance
(`docs/architecture/microservices-http.md` §"Topology"). auth-svc calls
org-svc's API synchronously when an organization is created.

`parishbooks-org-svc` currently exists only as unmodified Nx-generator
boilerplate (`apps/parishbooks-org-svc/src/app/{app.module,app.controller,app.service}.ts`)
with `ORG_SERVICE_PORT` (3006) and `Application.bootstrap` already wired
in `main.ts`. `OrganizationProfile` will be the first real domain entity
anywhere in `packages/database` — today only the abstract `BaseEntity`
and `TenantEntity` exist there, and the migrations folder is empty.

## 2. Entity: `OrganizationProfile`

New file: `packages/database/src/lib/entities/organization-profile.entity.ts`,
exported from `packages/database/src/lib/entities/index.ts`.

Extends `BaseEntity` directly — **not** `TenantEntity`. It represents the
organization itself, not tenant-scoped data belonging to one, so it has
no `organizationId`-as-scope column from `TenantEntity`; instead it has
its own `organizationId` as a unique FK-equivalent column (TypeORM entity
relation to BetterAuth's `organization.id`, which lives outside
`packages/database`'s own entity set since BetterAuth owns that table).

```ts
export enum OrganizationCountry {
    IN = 'IN',
    US = 'US',
}

export enum OrganizationPlanTier {
    STARTER = 'starter',
    PRO = 'pro',
}

export enum OrganizationCurrency {
    INR = 'INR',
    USD = 'USD',
}

@Entity('organization_profile')
@Unique(['organizationId'])
export class OrganizationProfile extends BaseEntity {
    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'enum', enum: OrganizationCountry, default: OrganizationCountry.IN })
    country!: OrganizationCountry;

    @Column({ type: 'boolean', default: false })
    fcraRegistered!: boolean;

    @Column({ type: 'enum', enum: OrganizationPlanTier, default: OrganizationPlanTier.STARTER })
    planTier!: OrganizationPlanTier;

    @Column({ type: 'text' })
    timezone!: string;

    @Column({ type: 'enum', enum: OrganizationCurrency, default: OrganizationCurrency.INR })
    currency!: OrganizationCurrency;

    @Column({ type: 'text', nullable: true })
    registrationNumber?: string;

    @Column({ type: 'text', nullable: true })
    taxExemptionNumber80g?: string;

    @Column({ type: 'text', nullable: true })
    ein?: string;
}
```

Field notes:

- `registrationNumber` — the organization's registration number, printed
  on 80G receipts.
- `taxExemptionNumber80g` — the 80G approval number.
- `ein` — reserved for the documented US 501(c)(3) Phase 2 addendum;
  unused until `country = 'US'` receipting is implemented, same pattern
  as `country`'s existing `'US'` placeholder value.
- `planTier` defaults to `starter` and is not settable at creation time by
  the client — see §3.
- Deliberately out of scope for this pass (per your scoping decision):
  `billingStatus`, `billingProvider`, and Cashfree vendor fields
  (`vendorId`, vendor status). Those belong to billing-svc/giving-svc
  integrations that don't exist yet and would sit unused; add them in a
  follow-up migration when those integrations are actually built.

This is also the first entity in the codebase to use a Postgres native
`enum` column (`{ type: 'enum', enum: [...] }`), establishing that as the
convention for the `enum(...)` columns `docs/specs/typeorm-database-schema.md`
describes elsewhere (e.g. `Account.type`, `Fund.type`) but that no entity
existed yet to confirm.

A migration will be generated via `typeorm migration:generate` against
`packages/database/src/data-source.ts` per the documented workflow —
this is the first real migration in the repo (the `migration/` folder is
currently just a `.gitkeep`).

## 3. org-svc: Module & API

`apps/parishbooks-org-svc/src/app/app.module.ts` is built out to match
every other service's pattern (currently bare Nx boilerplate):

```ts
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'org-svc' }),
        HttpClientModule.forRoot(),
        DatabaseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                url: configService.getOrThrow('DATABASE_URL'),
            }),
        }),
        TypeOrmModule.forFeature([OrganizationProfile]),
        OrganizationProfileModule,
    ],
    providers: [{ provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
```

New feature module `OrganizationProfileModule`
(`apps/parishbooks-org-svc/src/app/organization-profile/`):

- `organization-profile.repository.ts` — `OrganizationProfileRepository extends BaseRepository<OrganizationProfile>`, with a `findByOrganizationId(organizationId: string)` lookup. No tenant-scoping logic needed (this entity isn't `TenantEntity`), but following the repository-per-entity convention keeps future query methods in one place.
- `organization-profile.service.ts` — `create(organizationId, dto)`.
- `organization-profile.controller.ts` — the single endpoint below.
- `dto/create-organization-profile.dto.ts` — class-validator + `@nestjs/swagger`, matching the idiom in `apps/parishbooks-auth-svc/src/app/dto/organization.dto.ts`.

**Endpoint:** `POST /api/organizations/:organizationId/profile`

- `CreateOrganizationProfileDto`: `timezone` (required, `@IsString`);
  `country`, `currency`, `fcraRegistered`, `registrationNumber`,
  `taxExemptionNumber80g` all optional. `planTier` is not on the DTO at
  all — the service always creates with `OrganizationPlanTier.STARTER`.
- Guarded by the existing `AuthGuard` (bearer token round-tripped to
  auth-svc's `/api/identity/session`, identical to crm/billing/giving/
  ledger — no new guard or service-credential mechanism needed).
- The controller checks `params.organizationId === headers['x-tenant-id']`
  and rejects with 400 on mismatch — defense-in-depth beyond CLAUDE.md
  rule #1 ("never trust a tenant ID from a request body"): here the id
  isn't from the body at all, but the header/path agreement is checked
  anyway since this is the one endpoint in the system that establishes
  a new tenant rather than operating within an already-active one.
- Response: `OrganizationProfileDto` (the created row, camelCase fields
  matching the entity, minus `deletedAt`).

## 4. auth-svc Integration

In `apps/parishbooks-auth-svc/src/app/app.service.ts`, `createOrganization`
changes from a direct passthrough to:

```ts
async createOrganization(dto: CreateOrganizationDto, headers: Headers) {
    const org = await this.authService.api.createOrganization({ body: { ...dto }, headers });

    await this.httpClient.post(
        `${this.orgServiceUrl}/api/organizations/${org.id}/profile`,
        { timezone: dto.timezone },
        {
            headers: {
                Authorization: headers.get('authorization'),
                'x-tenant-id': org.id,
            },
        },
    );

    return org;
}
```

- `httpClient` is `HttpClientService` from `@parishbooks/core` — already
  available in auth-svc (`HttpClientModule.forRoot()` is already imported
  in `app.module.ts`, no new wiring needed).
- `orgServiceUrl` comes from a new `ORG_SERVICE_URL` env var, read via
  `ConfigService.getOrThrow`, following the same pattern `AuthGuard` uses
  for `AUTH_SERVICE_URL`.
- `CreateOrganizationDto` gains a required `timezone` field (client-
  supplied at org-creation time — there's no other source for it, since
  BetterAuth's own org creation has no timezone concept).
- Only `timezone` is sent at creation time. `country`, `currency`,
  `fcraRegistered`, `registrationNumber`, and `taxExemptionNumber80g` are
  all nullable/defaulted on the entity precisely because they aren't part
  of the sign-up flow — an org fills them in later via a settings screen
  that calls a (not-yet-designed) `PATCH` endpoint on the same resource.
  This design only covers creation.
- The call is **synchronous** and inside the same request/response cycle
  as `createOrganization` — if it throws, `createOrganization` throws,
  and the client gets an error. This was a deliberate choice (see §5)
  over a fire-and-forget/retry approach, prioritizing simplicity over
  resilience for this first pass.
- `Authorization` is forwarded unmodified from the original caller's
  request headers — the same "forward the caller's Bearer token" pattern
  CLAUDE.md rule #4 already establishes for every inter-service call, not
  a new mechanism.

## 5. Error Handling & Known Limitation

If BetterAuth successfully creates the `organization` row but the
subsequent org-svc call fails (org-svc down, network blip, validation
error), the org is left without a profile — a partial-write state with
no cross-service transaction to roll it back. This was chosen
deliberately (synchronous/simple over fire-and-forget/eventually-
consistent) because:

- It's simple to reason about and debug — a failure is visible
  immediately in the same request, not discovered later via a missing
  profile.
- A client retry of the *entire* "create organization" request will
  generally hit BetterAuth's own slug-uniqueness constraint rather than
  cleanly retrying end-to-end, so this needs manual/admin intervention
  if it happens (e.g. a support script that re-runs the profile-creation
  call for orgs with no `OrganizationProfile` row).

This is accepted as a known gap for v1, not solved here. If it proves to
happen often in practice, a follow-up (reconciliation job, or making the
org-svc endpoint idempotent/retryable from a queued job) is the natural
next step — out of scope for this design.

## 6. Testing

- **Entity/repository**: an integration test against a real Postgres
  (per `docs/quality-ops/testing-strategy.md` — no DB mocking) creating
  an `OrganizationProfile`, verifying the `@Unique(['organizationId'])`
  constraint rejects a duplicate.
- **org-svc controller**: a test asserting a request where the
  `:organizationId` path param doesn't match `x-tenant-id` is rejected
  with 400, and that `planTier` in the request body is ignored /
  rejected by `forbidNonWhitelisted` (it's not on the DTO).
- **auth-svc**: a test asserting that when the org-svc HTTP call throws,
  `createOrganization` propagates the failure (the org row still exists
  in BetterAuth's tables, but the caller sees an error) — this is the
  test that would fail if someone "fixed" this into silently swallowing
  the org-svc failure.
