# Stripe Billing Integration via BetterAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire BetterAuth's official `stripe()` plugin into `parishbooks-auth-svc` for org-scoped subscriptions (Starter/Pro tiers), syncing `OrganizationProfile.planTier`/`billingStatus` in `parishbooks-org-svc` over an internal HTTP call.

**Architecture:** BetterAuth owns Stripe Customer/Subscription lifecycle and webhook verification entirely (its own `subscription` table, its own `/api/auth/stripe/webhook` route). Its `onSubscriptionUpdate`/`onSubscriptionCancel` hooks push the resulting state into org-svc's new internal-only `PATCH /organizations/:organizationId/billing-sync` endpoint, guarded by a new shared-secret `InternalServiceGuard`. `EntitlementGuard` (unmodified) keeps reading `OrganizationProfile` as today.

**Tech Stack:** NestJS 11, BetterAuth `^1.7.2` + `@better-auth/stripe` `^1.7.3`, `stripe` `^22.6.1` (Node SDK), TypeORM (migration), `pg` (raw org-membership lookup inside `authorizeReference`).

**Spec:** `docs/superpowers/specs/2026-09-08-stripe-billing-integration-design.md`

## Global Constraints

- Migrations only — never `synchronize: true` (CLAUDE.md rule 3). Generate via `nx run database:typeorm-generate` against a running local Postgres, then commit the reviewed migration file.
- Every tenant-scoped query filters by `organizationId` (CLAUDE.md rule 1).
- Feature access stays behind `EntitlementGuard`/the plan matrix — this plan does not touch `EntitlementGuard` itself, only what writes the columns it reads (CLAUDE.md rule 7).
- Repository/service boundary: services never call `Repository`/`save`/`find*` directly — always through a named repository method (CLAUDE.md, Working Conventions).
- `INTERNAL_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID` are required env vars (via `configService.getOrThrow`) on the relevant services — a misconfigured billing integration fails at boot, not silently at runtime.
- No live Stripe network calls in any test — mock `HttpClientService`/`StripeClient` calls.

---

## Task 1: `OrganizationProfile` schema — `billingStatus` / `billingProvider`

**Files:**
- Modify: `packages/database/src/lib/entities/organization-profile.entity.ts`
- Create: a new migration file under `packages/database/src/lib/migration/` (name/timestamp assigned by the generator — do not hand-write it)
- Test: `packages/database/src/lib/entities/organization-profile.entity.spec.ts` (new)

**Interfaces:**
- Produces: `OrganizationBillingStatus` enum (`active | pastDue | locked | canceled`), `OrganizationBillingProvider` enum (`stripe | cashfree`), both exported from `@parishbooks/database` (via the existing `entities/index.ts` wildcard export — no change needed there). `OrganizationProfile.billingStatus: OrganizationBillingStatus` (default `active`), `OrganizationProfile.billingProvider?: OrganizationBillingProvider` (nullable).

- [ ] **Step 1: Write the failing test**

```ts
// packages/database/src/lib/entities/organization-profile.entity.spec.ts
import { OrganizationBillingStatus, OrganizationProfile } from './organization-profile.entity';

describe('OrganizationProfile', () => {
    it('defaults billingStatus to active on a new instance', () => {
        const profile = new OrganizationProfile();
        Object.assign(profile, { billingStatus: OrganizationBillingStatus.ACTIVE });
        expect(profile.billingStatus).toBe('active');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test database --testPathPatterns=organization-profile.entity`
Expected: FAIL — `OrganizationBillingStatus` is not exported from `./organization-profile.entity` (TypeScript compile error / `undefined` import).

- [ ] **Step 3: Add the columns to the entity**

Edit `packages/database/src/lib/entities/organization-profile.entity.ts` — add two enums and two columns, following the existing `OrganizationPlanTier`/`planTier` pattern exactly:

```ts
export enum OrganizationBillingStatus {
    ACTIVE = 'active',
    PAST_DUE = 'pastDue',
    LOCKED = 'locked',
    CANCELED = 'canceled',
}

export enum OrganizationBillingProvider {
    STRIPE = 'stripe',
    CASHFREE = 'cashfree',
}
```

Add inside the `OrganizationProfile` class, after the existing `planTier` column:

```ts
    @Column({ type: 'enum', enum: OrganizationBillingStatus, default: OrganizationBillingStatus.ACTIVE })
    billingStatus!: OrganizationBillingStatus;

    @Column({ type: 'enum', enum: OrganizationBillingProvider, nullable: true })
    billingProvider?: OrganizationBillingProvider;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test database --testPathPatterns=organization-profile.entity`
Expected: PASS

- [ ] **Step 5: Generate and review the migration**

Requires a running local Postgres reachable via the `DATABASE_URL` env var used by `packages/database/src/data-source.ts` (see `docs/dx/getting-started.md` for local DB setup if not already running).

Run: `npx nx run database:typeorm-generate`

This creates a new timestamped file under `packages/database/src/lib/migration/`. Open it and confirm it **only** adds the two new enum types and two new columns to `organization_profile` (no unrelated `DROP`/`ALTER` statements) — if TypeORM proposes anything else, the local schema is out of sync with entities; stop and reconcile before continuing, don't hand-edit the generated SQL.

- [ ] **Step 6: Run the migration locally**

Run: `npx nx run database:typeorm-migrate`
Expected: migration applies cleanly, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/lib/entities/organization-profile.entity.ts packages/database/src/lib/entities/organization-profile.entity.spec.ts packages/database/src/lib/migration/
git commit -m "feat(database): add billingStatus/billingProvider to OrganizationProfile"
```

---

## Task 2: `InternalServiceGuard` (packages/core)

**Files:**
- Create: `packages/core/src/lib/guard/internal/internal-service.guard.ts`
- Create: `packages/core/src/lib/guard/internal/internal-service.constants.ts`
- Create: `packages/core/src/lib/guard/internal/internal-service.guard.spec.ts`
- Modify: `packages/core/src/index.ts` (export the new guard + constants)

**Interfaces:**
- Consumes: `ConfigService` (`@nestjs/config`), `Reflector`-free (this guard is applied per-route via `@UseGuards`, never as `APP_GUARD` — it must never protect user-facing routes).
- Produces: `InternalServiceGuard` (class, implements `CanActivate`), `INTERNAL_SERVICE_KEY_ENV_KEY = 'INTERNAL_SERVICE_KEY'`, `INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key'`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/lib/guard/internal/internal-service.guard.spec.ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalServiceGuard } from './internal-service.guard';

function buildContext(headers: Record<string, string>): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
}

describe('InternalServiceGuard', () => {
    let guard: InternalServiceGuard;
    let configService: { getOrThrow: jest.Mock };

    beforeEach(() => {
        configService = { getOrThrow: jest.fn().mockReturnValue('shared-secret') };
        guard = new InternalServiceGuard(configService as unknown as ConfigService);
    });

    it('rejects a request with no internal service key header', () => {
        expect(() => guard.canActivate(buildContext({}))).toThrow(UnauthorizedException);
    });

    it('rejects a request with the wrong key', () => {
        expect(() => guard.canActivate(buildContext({ 'x-internal-service-key': 'wrong' }))).toThrow(UnauthorizedException);
    });

    it('accepts a request with the correct key', () => {
        expect(guard.canActivate(buildContext({ 'x-internal-service-key': 'shared-secret' }))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test core --testPathPatterns=internal-service.guard`
Expected: FAIL — cannot find module `./internal-service.guard`.

- [ ] **Step 3: Write the constants file**

```ts
// packages/core/src/lib/guard/internal/internal-service.constants.ts
export const INTERNAL_SERVICE_KEY_ENV_KEY = 'INTERNAL_SERVICE_KEY';
export const INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key';
```

- [ ] **Step 4: Write the guard**

```ts
// packages/core/src/lib/guard/internal/internal-service.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'node:http';
import { INTERNAL_SERVICE_KEY_ENV_KEY, INTERNAL_SERVICE_KEY_HEADER } from './internal-service.constants';

/**
 * Guards service-to-service-only endpoints with a static shared secret
 * (INTERNAL_SERVICE_KEY, same value on caller and callee). A deliberate v1
 * simplification vs. the JWT-rotation scheme in
 * docs/architecture/microservices-http.md §5 — apply directly with
 * @UseGuards(InternalServiceGuard) per-route, never as APP_GUARD, and pair
 * with @Public() so the user-facing AuthGuard doesn't also demand a Bearer
 * token these calls don't carry.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
    private readonly logger = new Logger(InternalServiceGuard.name);

    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<IncomingMessage>();
        const expected = this.configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY);
        const provided = req.headers[INTERNAL_SERVICE_KEY_HEADER];
        if (provided !== expected) {
            this.logger.warn(`Rejected request with missing or invalid ${INTERNAL_SERVICE_KEY_HEADER}`);
            throw new UnauthorizedException();
        }
        return true;
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test core --testPathPatterns=internal-service.guard`
Expected: PASS

- [ ] **Step 6: Export from the package index**

Add to `packages/core/src/index.ts`, after the existing guard exports:

```ts
export * from './lib/guard/internal/internal-service.guard';
export * from './lib/guard/internal/internal-service.constants';
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/guard/internal/ packages/core/src/index.ts
git commit -m "feat(core): add InternalServiceGuard for shared-secret service-to-service calls"
```

---

## Task 3: org-svc internal billing-sync endpoint

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/dto/sync-billing.dto.ts`
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.ts`
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.spec.ts`
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.ts`
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.spec.ts`

**Interfaces:**
- Consumes: `OrganizationProfileRepository.updateProfile(id: string, data: Partial<OrganizationProfile>): Promise<OrganizationProfile>` (exists, Task from earlier work), `OrganizationProfileService.findByOrganizationId(organizationId: string): Promise<OrganizationProfile>` (exists), `InternalServiceGuard` (Task 2), `OrganizationBillingStatus`/`OrganizationBillingProvider` (Task 1).
- Produces: `OrganizationProfileService.syncBilling(organizationId: string, dto: SyncBillingDto): Promise<OrganizationProfile>`, `OrganizationProfileController.syncBilling(...)` mapped to `PATCH :organizationId/billing-sync`.

- [ ] **Step 1: Write the failing service test**

Add to `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.spec.ts`:

```ts
import { OrganizationBillingStatus } from '@parishbooks/database';
// ...

it('throws NotFoundException when syncing billing for a profile that does not exist', async () => {
    repository.findByOrganizationId.mockResolvedValue(null);

    await expect(service.syncBilling('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE })).rejects.toThrow(NotFoundException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
});

it('syncs only the fields provided', async () => {
    repository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', organizationId: 'org-1' });

    await service.syncBilling('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE });

    expect(repository.updateProfile).toHaveBeenCalledWith('profile-1', { billingStatus: OrganizationBillingStatus.PAST_DUE });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPatterns=organization-profile.service`
Expected: FAIL — `service.syncBilling is not a function`.

- [ ] **Step 3: Write the DTO**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/dto/sync-billing.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationBillingProvider, OrganizationBillingStatus, OrganizationPlanTier } from '@parishbooks/database';
import { IsIn, IsOptional } from 'class-validator';

export class SyncBillingDto {
    @ApiPropertyOptional({ enum: OrganizationPlanTier })
    @IsOptional()
    @IsIn(Object.values(OrganizationPlanTier))
    planTier?: OrganizationPlanTier;

    @ApiPropertyOptional({ enum: OrganizationBillingStatus })
    @IsOptional()
    @IsIn(Object.values(OrganizationBillingStatus))
    billingStatus?: OrganizationBillingStatus;

    @ApiPropertyOptional({ enum: OrganizationBillingProvider })
    @IsOptional()
    @IsIn(Object.values(OrganizationBillingProvider))
    billingProvider?: OrganizationBillingProvider;
}
```

- [ ] **Step 4: Implement `syncBilling` in the service**

Add to `organization-profile.service.ts`, alongside the existing `update` method:

```ts
    async syncBilling(organizationId: string, dto: SyncBillingDto): Promise<OrganizationProfile> {
        const profile = await this.findByOrganizationId(organizationId);
        return this.repository.updateProfile(profile.id, dto);
    }
```

Add the import: `import { SyncBillingDto } from './dto/sync-billing.dto';`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPatterns=organization-profile.service`
Expected: PASS

- [ ] **Step 6: Write the failing controller test**

Add to `organization-profile.controller.spec.ts`:

```ts
service = { create: jest.fn(), findByOrganizationId: jest.fn(), update: jest.fn(), syncBilling: jest.fn() };
// ...

it('delegates billing sync to the service without a tenant-header check', async () => {
    service.syncBilling.mockResolvedValue({ id: 'profile-1', billingStatus: 'pastDue' });

    const result = await controller.syncBilling('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE } as SyncBillingDto);

    expect(service.syncBilling).toHaveBeenCalledWith('org-1', { billingStatus: OrganizationBillingStatus.PAST_DUE });
    expect(result).toEqual({ id: 'profile-1', billingStatus: 'pastDue' });
});
```

Add imports: `import { OrganizationBillingStatus } from '@parishbooks/database';` and `import { SyncBillingDto } from './dto/sync-billing.dto';`.

- [ ] **Step 7: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPatterns=organization-profile.controller`
Expected: FAIL — `controller.syncBilling is not a function`.

- [ ] **Step 8: Implement the controller route**

Add to `organization-profile.controller.ts`:

```ts
import { InternalServiceGuard, Public } from '@parishbooks/core';
import { UseGuards } from '@nestjs/common';
// ... alongside the other imports, add SyncBillingDto

    @ApiProperty({ name: 'syncOrganizationBilling', status: HttpStatus.OK, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Patch(':organizationId/billing-sync')
    syncBilling(@Param('organizationId') organizationId: string, @Body() dto: SyncBillingDto) {
        return this.service.syncBilling(organizationId, dto);
    }
```

This route intentionally does **not** go through `assertTenantMatch` — there's no end-user `x-tenant-id` header on a service-to-service call; `InternalServiceGuard` is the trust boundary here instead.

- [ ] **Step 9: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPatterns=organization-profile.controller`
Expected: PASS

- [ ] **Step 10: Run the full org-svc suite and build**

Run: `npx nx run-many -t build,lint,test -p parishbooks-org-svc`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-profile/
git commit -m "feat(org-svc): add internal billing-sync endpoint guarded by InternalServiceGuard"
```

---

## Task 4: auth-svc — add Stripe deps and extend config type

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/parishbooks-auth-svc/src/types/auth.types.ts`

**Interfaces:**
- Produces: `BetterAuthConfig` gains `stripeSecretKey: string; stripeWebhookSecret: string; stripeStarterPriceId: string; stripeProPriceId: string; orgServiceUrl: string; internalServiceKey: string;`

- [ ] **Step 1: Add dependencies**

Edit root `package.json`'s `dependencies` block (alphabetical order, matching existing style):

```json
        "@better-auth/stripe": "^1.7.3",
```
placed before `"@nestjs/axios"`, and:
```json
        "stripe": "^22.6.1",
```
placed after `"rxjs"` and before `"typeorm"`.

Run: `bun install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Extend `BetterAuthConfig`**

```ts
// apps/parishbooks-auth-svc/src/types/auth.types.ts
export interface BetterAuthConfig {
    secret: string;
    baseURL: string;
    databaseURL: string;
    googleClientId: string;
    googleClientSecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    stripeStarterPriceId: string;
    stripeProPriceId: string;
    orgServiceUrl: string;
    internalServiceKey: string;
}
```

- [ ] **Step 3: Verify the codebase still typechecks (config isn't fully wired yet, so callers will fail — expected until Task 5)**

Run: `npx nx run parishbooks-auth-svc:build`
Expected: FAIL — `auth.ts` and `app.module.ts` are missing the new required fields when constructing `betterAuthConfig(...)`. This confirms the type change took effect; Task 5 fixes both call sites.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock apps/parishbooks-auth-svc/src/types/auth.types.ts
git commit -m "chore(auth-svc): add stripe deps and extend BetterAuthConfig for billing"
```

---

## Task 5: auth-svc — wire the `stripe()` plugin

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/libs/auth.config.ts`
- Modify: `apps/parishbooks-auth-svc/src/auth.ts`
- Modify: `apps/parishbooks-auth-svc/src/app/app.module.ts`
- Create: `apps/parishbooks-auth-svc/src/libs/auth.config.spec.ts`

**Interfaces:**
- Consumes: `BetterAuthConfig` (Task 4), `InternalServiceGuard`'s header contract (Task 2 — `x-internal-service-key`), org-svc's `PATCH /organizations/:organizationId/billing-sync` (Task 3), `HttpClientService` (`@parishbooks/core`).
- Produces: `mapStripeSubscriptionToBillingSync(subscription: { plan: string; status: string }): { planTier?: string; billingStatus: string }` — extracted as a standalone function so the event→state mapping is unit-testable without invoking the plugin.

- [ ] **Step 1: Write the failing test for the mapping function**

```ts
// apps/parishbooks-auth-svc/src/libs/auth.config.spec.ts
import { mapStripeSubscriptionToBillingSync } from './auth.config';

describe('mapStripeSubscriptionToBillingSync', () => {
    it('maps an active subscription to billingStatus active and the matching planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'active' })).toEqual({
            planTier: 'pro',
            billingStatus: 'active',
        });
    });

    it('maps a past_due subscription to billingStatus pastDue without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'past_due' })).toEqual({
            billingStatus: 'pastDue',
        });
    });

    it('maps a canceled subscription to billingStatus canceled without changing planTier', () => {
        expect(mapStripeSubscriptionToBillingSync({ plan: 'pro', status: 'canceled' })).toEqual({
            billingStatus: 'canceled',
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-auth-svc --testPathPatterns=auth.config`
Expected: FAIL — `mapStripeSubscriptionToBillingSync` is not exported from `./auth.config`.

- [ ] **Step 3: Implement the mapping function and the plugin wiring**

Replace the full contents of `apps/parishbooks-auth-svc/src/libs/auth.config.ts`:

```ts
import { Logger } from '@nestjs/common';
import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { bearer, emailOTP, organization } from 'better-auth/plugins';
import { HttpClientService, INTERNAL_SERVICE_KEY_HEADER } from '@parishbooks/core';
import Stripe from 'stripe';
import { Pool } from 'pg';
import { BetterAuthConfig } from '../types/auth.types';
import { buildConnectionPool } from '../utils/auth.utils';

const logger = new Logger('EmailOTP');
const billingLogger = new Logger('StripeBilling');

interface StripeSubscriptionSummary {
    plan: string;
    status: string;
}

/**
 * Maps a BetterAuth stripe-plugin subscription state to the fields org-svc's
 * billing-sync endpoint expects. `planTier` is only included on an active
 * subscription — a status-only change (past_due/canceled) must not stomp the
 * org's last-known plan tier.
 */
export const mapStripeSubscriptionToBillingSync = (subscription: StripeSubscriptionSummary): { planTier?: string; billingStatus: string } => {
    const statusMap: Record<string, string> = { active: 'active', past_due: 'pastDue', canceled: 'canceled', unpaid: 'pastDue' };
    const billingStatus = statusMap[subscription.status] ?? 'pastDue';
    return billingStatus === 'active' ? { planTier: subscription.plan, billingStatus } : { billingStatus };
};

const authorizeOrganizationBillingReference = (pool: Pool) => {
    return async ({ user, referenceId }: { user: { id: string }; referenceId: string }): Promise<boolean> => {
        const result = await pool.query<{ role: string }>('SELECT role FROM auth.member WHERE organization_id = $1 AND user_id = $2', [
            referenceId,
            user.id,
        ]);
        const role = result.rows[0]?.role;
        return role === 'owner' || role === 'admin';
    };
};

const syncOrgBilling = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    return async (referenceId: string, subscription: StripeSubscriptionSummary): Promise<void> => {
        try {
            await httpClient.patch(`${config.orgServiceUrl}/organizations/${referenceId}/billing-sync`, mapStripeSubscriptionToBillingSync(subscription), {
                headers: { [INTERNAL_SERVICE_KEY_HEADER]: config.internalServiceKey },
            });
        } catch (error) {
            billingLogger.error(`Failed to sync billing for organization ${referenceId}: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        }
    };
};

export const betterAuthConfig = (config: BetterAuthConfig, httpClient: HttpClientService) => {
    const { googleClientId, googleClientSecret } = config;
    const pool = buildConnectionPool(config.databaseURL);
    const stripeClient = new Stripe(config.stripeSecretKey);
    const syncBilling = syncOrgBilling(config, httpClient);

    return betterAuth({
        hooks: {},
        databaseHooks: {},
        secret: config.secret,
        baseURL: config.baseURL,
        database: pool,
        advanced: { database: { joins: true, generateId: 'uuid' } },
        emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 6 },
        socialProviders: { google: { clientId: googleClientId, clientSecret: googleClientSecret } },
        plugins: [
            organization({ invitationLimit: 1, allowUserToCreateOrganization: true, organizationHooks: {} }),
            bearer(),
            emailOTP({
                otpLength: 6,
                overrideDefaultEmailVerification: true,
                sendVerificationOnSignUp: true,
                sendVerificationOTP: async ({ email, otp, type }) => {
                    logger.log(`OTP ${otp} for ${email} (${type})`);
                },
            }),
            stripe({
                stripeClient,
                stripeWebhookSecret: config.stripeWebhookSecret,
                createCustomerOnSignUp: true,
                subscription: {
                    enabled: true,
                    plans: [
                        { name: 'starter', priceId: config.stripeStarterPriceId },
                        { name: 'pro', priceId: config.stripeProPriceId },
                    ],
                    authorizeReference: authorizeOrganizationBillingReference(pool),
                    onSubscriptionUpdate: async ({ subscription }) => {
                        await syncBilling(subscription.referenceId, { plan: subscription.plan, status: subscription.status });
                    },
                    onSubscriptionCancel: async ({ subscription }) => {
                        await syncBilling(subscription.referenceId, { plan: subscription.plan, status: 'canceled' });
                    },
                },
                organization: { enabled: true },
            }),
        ],
    });
};
```

`betterAuthConfig` now takes `httpClient` as a second argument — both call sites (`auth.ts`, `app.module.ts`) need an `HttpClientService` instance, handled in Step 5/6 below.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test parishbooks-auth-svc --testPathPatterns=auth.config`
Expected: PASS

- [ ] **Step 5: Update `auth.ts`**

`auth.ts` runs standalone (outside Nest's DI, e.g. for the `better-auth` CLI's `migrate`/`generate` commands) and has no `HttpClientService` instance. Construct a minimal one directly:

```ts
// apps/parishbooks-auth-svc/src/auth.ts
import { HttpService } from '@nestjs/axios';
import { HttpClientService, TransactionContext } from '@parishbooks/core';
import { betterAuthConfig } from './libs/auth.config';

const httpClient = new HttpClientService(new HttpService(), new TransactionContext());

export const auth = betterAuthConfig(
    {
        secret: process.env.BETTER_AUTH_SECRET || '',
        baseURL: process.env.BETTER_AUTH_URL || '',
        databaseURL: process.env.DATABASE_URL || '',
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID || '',
        stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
        orgServiceUrl: process.env.ORG_SERVICE_URL || '',
        internalServiceKey: process.env.INTERNAL_SERVICE_KEY || '',
    },
    httpClient,
);
```

- [ ] **Step 6: Update `app.module.ts`**

```ts
// apps/parishbooks-auth-svc/src/app/app.module.ts
import { HttpClientService } from '@parishbooks/core';
// ... existing imports unchanged

        AuthModule.forRootAsync({
            inject: [ConfigService, HttpClientService],
            useFactory: async (configService: ConfigService, httpClient: HttpClientService) => ({
                auth: betterAuthConfig(
                    {
                        secret: configService.getOrThrow('BETTER_AUTH_SECRET'),
                        baseURL: configService.getOrThrow('BETTER_AUTH_URL'),
                        databaseURL: configService.getOrThrow('DATABASE_URL'),
                        googleClientId: configService.getOrThrow('GOOGLE_CLIENT_ID'),
                        googleClientSecret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
                        stripeSecretKey: configService.getOrThrow('STRIPE_SECRET_KEY'),
                        stripeWebhookSecret: configService.getOrThrow('STRIPE_WEBHOOK_SECRET'),
                        stripeStarterPriceId: configService.getOrThrow('STRIPE_STARTER_PRICE_ID'),
                        stripeProPriceId: configService.getOrThrow('STRIPE_PRO_PRICE_ID'),
                        orgServiceUrl: configService.getOrThrow('ORG_SERVICE_URL'),
                        internalServiceKey: configService.getOrThrow('INTERNAL_SERVICE_KEY'),
                    },
                    httpClient,
                ),
            }),
        }),
```

(`HttpClientModule.forRoot()` is already imported in this module, so `HttpClientService` is available to inject.)

- [ ] **Step 7: Build and run the full auth-svc suite**

Run: `npx nx run-many -t build,lint,test -p parishbooks-auth-svc`
Expected: all green — this also confirms the Task 4 build failure from Step 3 is now resolved.

- [ ] **Step 8: Commit**

```bash
git add apps/parishbooks-auth-svc/src/libs/auth.config.ts apps/parishbooks-auth-svc/src/libs/auth.config.spec.ts apps/parishbooks-auth-svc/src/auth.ts apps/parishbooks-auth-svc/src/app/app.module.ts
git commit -m "feat(auth-svc): wire BetterAuth stripe() plugin for org-scoped subscriptions"
```

---

## Task 6: env var plumbing + docs update

**Files:**
- Modify: `docs/integrations/stripe-saas-billing.md`
- Modify: `docs/architecture/subscription-entitlements.md`
- Modify: any `.env.example` file(s) for `parishbooks-auth-svc` and `parishbooks-org-svc`, if they exist (check with `find apps -iname ".env.example"`)

**Interfaces:** none (docs/config only).

- [ ] **Step 1: Check for existing `.env.example` files**

Run: `find apps -iname ".env.example"`

If any exist for `parishbooks-auth-svc` or `parishbooks-org-svc`, add the new keys used in Task 4/5: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `ORG_SERVICE_URL`, `INTERNAL_SERVICE_KEY` (auth-svc), and `INTERNAL_SERVICE_KEY` (org-svc) — placeholder values only (e.g. `sk_test_...`), never real secrets. If no such files exist yet in this repo, skip this step (don't introduce a new convention unilaterally).

- [ ] **Step 2: Update `docs/integrations/stripe-saas-billing.md`**

Replace the "## 2. Webhook Handling" section's opening paragraph (the one starting "Verified via the Stripe SDK's `constructEvent`...") with:

```markdown
Handled entirely by BetterAuth's `stripe()` plugin, mounted on
`parishbooks-auth-svc` (`POST /api/auth/stripe/webhook`) — signature
verification, event parsing, and idempotency are the plugin's
responsibility, not a hand-rolled handler. The plugin's
`onSubscriptionUpdate`/`onSubscriptionCancel` hooks push the resulting
`planTier`/`billingStatus` into `OrganizationProfile` via an internal
HTTP call to `parishbooks-org-svc`'s `PATCH
/organizations/:organizationId/billing-sync` endpoint, guarded by a
shared-secret `InternalServiceGuard` (see
`docs/superpowers/specs/2026-09-08-stripe-billing-integration-design.md`
for the full design). `parishbooks-billing-svc` has no role in Stripe
webhook handling.
```

Keep the event table below it as-is (still accurate — same states, now driven by the plugin's hooks).

- [ ] **Step 3: Update `docs/architecture/subscription-entitlements.md`**

In "## 4. Source of Truth: Stripe vs. Cashfree Subscriptions", add a bullet after the existing "`OrganizationProfile.billingProvider`..." bullet:

```markdown
- `billingProvider`/`billingStatus` are written by `parishbooks-auth-svc`'s
  BetterAuth `stripe()` plugin hooks (for Stripe-billed orgs) via an
  internal HTTP call to org-svc — not by `parishbooks-billing-svc`. See
  `docs/superpowers/specs/2026-09-08-stripe-billing-integration-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/integrations/stripe-saas-billing.md docs/architecture/subscription-entitlements.md
git commit -m "docs: reflect BetterAuth stripe() plugin as the Stripe webhook owner"
```

---

## Final verification

- [ ] Run `npx nx affected -t lint test build` from the repo root against the changes in this plan and confirm everything is green before considering the plan complete.
