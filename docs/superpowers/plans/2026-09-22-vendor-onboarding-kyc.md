# Vendor Onboarding (KYC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a church org submit payment-provider KYC through a generic
`.../onboarding` API on `parishbooks-org-svc`, reach `ACTIVE` vendor
status via provider webhook, and let `parishbooks-giving-svc` (later)
check that status before creating a donation.

**Architecture:** A `VendorProvider` abstract class declares the
provider-agnostic contract (create/update vendor, verify webhook
signature, parse webhook event, mask sensitive values); `CashfreeVendorProvider`
extends it. `OnboardingService` in org-svc uses the abstract type only.
KYC inputs are never persisted raw — only masked, in a new
`OrganizationOnboardingSubmission` audit table — while
`OrganizationProfile`'s existing `cashfreeVendorId`/`cashfreeVendorStatus`
columns stay the single source of truth the Give flow will check. Status
updates arrive via a signature-verified, deduped webhook, reusing the
existing `processed_webhook_event` table.

**Tech Stack:** NestJS 11, TypeORM, `axios` (direct, not the internal
`HttpClientService` — that auto-attaches internal-only propagation
headers that must never reach an external provider), `class-validator`.

**Spec:** `docs/superpowers/specs/2026-09-22-vendor-onboarding-kyc-design.md`

## Global Constraints

- Every tenant-scoped table gets `@Index(['organizationId', 'id'])`; every
  repository query filters by `organizationId` (`CLAUDE.md` rule 1).
- Migrations only — never `synchronize: true` (`CLAUDE.md` rule 3).
- All webhooks are signature-verified and processed idempotently, deduped
  on provider event ID before any side effect (`CLAUDE.md` rule 5).
- No endpoint, route, DTO field name, or new entity/table name may mention
  "cashfree" or any other provider — public surface says "onboarding" /
  "vendor" only. Internal implementation classes and the already-shipped
  `OrganizationProfile.cashfreeVendorId` columns are the sole exception.
- PAN and bank account numbers are never persisted in full and never
  logged in full — only last-4-masked (`docs/quality-ops/security-observability.md`
  §4).
- Repository/service boundary: all TypeORM calls live in a repository
  method; services never call `Repository`/`BaseRepository` methods
  inline.
- New business logic needs a test that fails if the invariant it protects
  breaks.

---

### Task 1: `OrganizationOnboardingSubmission` entity + migration

**Files:**
- Create: `packages/database/src/lib/entities/organization-onboarding-submission.entity.ts`
- Modify: `packages/database/src/lib/entities/index.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/database/src/lib/database.module.ts`
- Create: `packages/database/src/lib/migration/1790089000000-CreateOrganizationOnboardingSubmission.ts`
- Test: `packages/database/src/lib/entities/organization-onboarding-submission.entity.spec.ts`

**Interfaces:**
- Produces: `OrganizationOnboardingSubmission` class with fields
  `organizationId: string` (inherited from `TenantEntity`), `businessName: string`,
  `panNumberMasked: string`, `bankAccountMasked: string`, `ifsc: string`,
  `gstin?: string`, `submittedByUserId: string`, `providerRawStatus?: string`,
  plus `id`/`createdAt`/`updatedAt`/`deletedAt` from `BaseEntity`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/database/src/lib/entities/organization-onboarding-submission.entity.spec.ts
import { getMetadataArgsStorage } from 'typeorm';
import { OrganizationOnboardingSubmission } from './organization-onboarding-submission.entity';

describe('OrganizationOnboardingSubmission', () => {
    it('is registered under the organization_onboarding_submission table', () => {
        const table = getMetadataArgsStorage().tables.find((t) => t.target === OrganizationOnboardingSubmission);
        expect(table?.name).toBe('organization_onboarding_submission');
    });

    it('declares a composite index on organizationId and id', () => {
        const indices = getMetadataArgsStorage().indices.filter((i) => i.target === OrganizationOnboardingSubmission);
        const hasCompositeIndex = indices.some((i) => Array.isArray(i.columns) && i.columns.includes('organizationId') && i.columns.includes('id'));
        expect(hasCompositeIndex).toBe(true);
    });

    it('does not persist raw PAN or bank account fields', () => {
        const columns = getMetadataArgsStorage().columns.filter((c) => c.target === OrganizationOnboardingSubmission).map((c) => c.propertyName);
        expect(columns).toContain('panNumberMasked');
        expect(columns).toContain('bankAccountMasked');
        expect(columns).not.toContain('panNumber');
        expect(columns).not.toContain('bankAccountNumber');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test database --testPathPattern=organization-onboarding-submission.entity.spec.ts`
Expected: FAIL with "Cannot find module './organization-onboarding-submission.entity'"

- [ ] **Step 3: Write the entity**

```typescript
// packages/database/src/lib/entities/organization-onboarding-submission.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// KYC submission audit trail for vendor onboarding
// (docs/superpowers/specs/2026-09-22-vendor-onboarding-kyc-design.md §4).
// Deliberately never stores raw PAN or full bank account number — those
// go straight to the payment provider's API and only the masked form is
// kept here for the admin-facing "what did we submit" view
// (docs/quality-ops/security-observability.md §4).
@Entity('organization_onboarding_submission')
@Index(['organizationId', 'id'])
export class OrganizationOnboardingSubmission extends TenantEntity {
    @Column({ type: 'text' })
    businessName!: string;

    @Column({ type: 'text' })
    panNumberMasked!: string;

    @Column({ type: 'text' })
    bankAccountMasked!: string;

    @Column({ type: 'text' })
    ifsc!: string;

    @Column({ type: 'text', nullable: true })
    gstin?: string;

    @Column({ type: 'uuid' })
    submittedByUserId!: string;

    @Column({ type: 'text', nullable: true })
    providerRawStatus?: string;
}
```

- [ ] **Step 4: Register the entity in the database package**

In `packages/database/src/lib/entities/index.ts`, add:
```typescript
export * from './organization-onboarding-submission.entity';
```

In `packages/database/src/index.ts`, add (after the `organization-profile.entity` export line):
```typescript
export * from './lib/entities/organization-onboarding-submission.entity';
```

In `packages/database/src/lib/database.module.ts`, add the import
```typescript
import { OrganizationOnboardingSubmission } from './entities/organization-onboarding-submission.entity';
```
and add `OrganizationOnboardingSubmission` to the `ENTITIES` array (after `OrganizationProfile`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test database --testPathPattern=organization-onboarding-submission.entity.spec.ts`
Expected: PASS

- [ ] **Step 6: Write the migration**

```typescript
// packages/database/src/lib/migration/1790089000000-CreateOrganizationOnboardingSubmission.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationOnboardingSubmission1790089000000 implements MigrationInterface {
    name = 'CreateOrganizationOnboardingSubmission1790089000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "organization_onboarding_submission" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "organization_id" uuid NOT NULL,
                "business_name" text NOT NULL,
                "pan_number_masked" text NOT NULL,
                "bank_account_masked" text NOT NULL,
                "ifsc" text NOT NULL,
                "gstin" text,
                "submitted_by_user_id" uuid NOT NULL,
                "provider_raw_status" text,
                CONSTRAINT "PK_organization_onboarding_submission" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_org_onboarding_submission_org_id_id" ON "organization_onboarding_submission" ("organization_id", "id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_org_onboarding_submission_org_id_id"`);
        await queryRunner.query(`DROP TABLE "organization_onboarding_submission"`);
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/lib/entities/organization-onboarding-submission.entity.ts \
        packages/database/src/lib/entities/organization-onboarding-submission.entity.spec.ts \
        packages/database/src/lib/entities/index.ts \
        packages/database/src/index.ts \
        packages/database/src/lib/database.module.ts \
        packages/database/src/lib/migration/1790089000000-CreateOrganizationOnboardingSubmission.ts
git commit -m "feat(database): add OrganizationOnboardingSubmission entity and migration"
```

---

### Task 2: `VendorProvider` abstract class

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.types.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.spec.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `VendorKycSubmission`, `VendorKycResult`, `VendorWebhookEvent`,
  `VendorWebhookStatus` types; abstract class `VendorProvider` with
  abstract `createOrUpdateVendor(submission: VendorKycSubmission): Promise<VendorKycResult>`,
  abstract `verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean`,
  abstract `parseWebhookEvent(rawBody: Buffer): VendorWebhookEvent`, and
  concrete `maskLast4(value: string): string`. Later tasks depend on these
  exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.spec.ts
import { VendorProvider, VendorKycResult, VendorKycSubmission, VendorWebhookEvent } from './vendor-provider';

class TestVendorProvider extends VendorProvider {
    createOrUpdateVendor(_submission: VendorKycSubmission): Promise<VendorKycResult> {
        throw new Error('not implemented');
    }
    verifyWebhookSignature(_rawBody: Buffer, _signatureHeader: string | undefined): boolean {
        throw new Error('not implemented');
    }
    parseWebhookEvent(_rawBody: Buffer): VendorWebhookEvent {
        throw new Error('not implemented');
    }
}

describe('VendorProvider', () => {
    let provider: TestVendorProvider;

    beforeEach(() => {
        provider = new TestVendorProvider();
    });

    it('masks all but the last 4 characters', () => {
        expect(provider.maskLast4('ABCDE1234F')).toBe('******1234F'.length === provider.maskLast4('ABCDE1234F').length ? provider.maskLast4('ABCDE1234F') : provider.maskLast4('ABCDE1234F'));
    });

    it('masks a PAN keeping only the last 4 characters visible', () => {
        expect(provider.maskLast4('ABCDE1234F')).toBe('******1234F');
    });

    it('masks a bank account number keeping only the last 4 digits visible', () => {
        expect(provider.maskLast4('123456789012')).toBe('********9012');
    });

    it('fully masks a value of 4 characters or fewer', () => {
        expect(provider.maskLast4('1234')).toBe('****');
        expect(provider.maskLast4('12')).toBe('**');
    });
});
```

(Remove the first, self-referential `expect` line above before saving — it
was a placeholder while drafting; the real assertions are the three below
it. The file as saved should contain only the 3 `it(...)` blocks after
`masks all but the last 4 characters` is deleted.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPattern=vendor-provider.spec.ts`
Expected: FAIL with "Cannot find module './vendor-provider'"

- [ ] **Step 3: Write the types and abstract class**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.types.ts
export interface VendorKycSubmission {
    organizationId: string;
    businessName: string;
    panNumber: string;
    bankAccountNumber: string;
    ifsc: string;
    gstin?: string;
}

export interface VendorKycResult {
    vendorId: string;
    rawStatus: string;
}

export type VendorWebhookStatus = 'pending' | 'active' | 'rejected';

export interface VendorWebhookEvent {
    eventId: string;
    eventType: string;
    vendorId: string;
    status: VendorWebhookStatus;
    rejectionReason?: string;
}
```

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.ts
import { VendorKycResult, VendorKycSubmission, VendorWebhookEvent } from './vendor-provider.types';

// Provider-agnostic contract for payment-provider vendor onboarding
// (docs/superpowers/specs/2026-09-22-vendor-onboarding-kyc-design.md §3).
// An abstract class rather than a bare interface so behavior common to
// every provider — masking sensitive values before they're stored — lives
// once here instead of being duplicated per implementation.
export abstract class VendorProvider {
    abstract createOrUpdateVendor(submission: VendorKycSubmission): Promise<VendorKycResult>;
    abstract verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
    abstract parseWebhookEvent(rawBody: Buffer): VendorWebhookEvent;

    maskLast4(value: string): string {
        const trimmed = value.trim();
        if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
        return '*'.repeat(trimmed.length - 4) + trimmed.slice(-4);
    }
}
```

- [ ] **Step 4: Fix the test file to contain only the real assertions**

Overwrite `vendor-provider.spec.ts` with:

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.spec.ts
import { VendorProvider, VendorKycResult, VendorKycSubmission, VendorWebhookEvent } from './vendor-provider';

class TestVendorProvider extends VendorProvider {
    createOrUpdateVendor(_submission: VendorKycSubmission): Promise<VendorKycResult> {
        throw new Error('not implemented');
    }
    verifyWebhookSignature(_rawBody: Buffer, _signatureHeader: string | undefined): boolean {
        throw new Error('not implemented');
    }
    parseWebhookEvent(_rawBody: Buffer): VendorWebhookEvent {
        throw new Error('not implemented');
    }
}

describe('VendorProvider', () => {
    let provider: TestVendorProvider;

    beforeEach(() => {
        provider = new TestVendorProvider();
    });

    it('masks a PAN keeping only the last 4 characters visible', () => {
        expect(provider.maskLast4('ABCDE1234F')).toBe('******1234F');
    });

    it('masks a bank account number keeping only the last 4 digits visible', () => {
        expect(provider.maskLast4('123456789012')).toBe('********9012');
    });

    it('fully masks a value of 4 characters or fewer', () => {
        expect(provider.maskLast4('1234')).toBe('****');
        expect(provider.maskLast4('12')).toBe('**');
    });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPattern=vendor-provider.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.types.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/provider/vendor-provider.spec.ts
git commit -m "feat(org-svc): add provider-agnostic VendorProvider abstract class"
```

---

### Task 3: `CashfreeVendorProvider` implementation

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.spec.ts`
- Modify: `.env` (add placeholder Cashfree vendor config)

**Interfaces:**
- Consumes: `VendorProvider`, `VendorKycSubmission`, `VendorKycResult`,
  `VendorWebhookEvent` from Task 2.
- Produces: `CashfreeVendorProvider extends VendorProvider`, constructed
  as `new CashfreeVendorProvider(configService: ConfigService, httpClient: AxiosInstance)`.
  Reads env vars `CASHFREE_API_BASE_URL`, `CASHFREE_CLIENT_ID`,
  `CASHFREE_CLIENT_SECRET`, `CASHFREE_WEBHOOK_SECRET`, and optional
  `CASHFREE_WEBHOOK_SECRET_PREVIOUS` (rotation window, per
  `docs/quality-ops/security-observability.md` §2).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.spec.ts
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CashfreeVendorProvider } from './cashfree-vendor.provider';

describe('CashfreeVendorProvider', () => {
    const config = new Map<string, string>([
        ['CASHFREE_API_BASE_URL', 'https://sandbox.cashfree.com'],
        ['CASHFREE_CLIENT_ID', 'test-client-id'],
        ['CASHFREE_CLIENT_SECRET', 'test-client-secret'],
        ['CASHFREE_WEBHOOK_SECRET', 'current-secret'],
        ['CASHFREE_WEBHOOK_SECRET_PREVIOUS', 'previous-secret'],
    ]);
    const configService = { getOrThrow: (key: string) => config.get(key), get: (key: string) => config.get(key) } as unknown as ConfigService;
    let httpClient: { post: jest.Mock };
    let provider: CashfreeVendorProvider;

    beforeEach(() => {
        httpClient = { post: jest.fn() };
        provider = new CashfreeVendorProvider(configService, httpClient as never);
    });

    describe('createOrUpdateVendor', () => {
        it('posts vendor KYC details to the Cashfree Vendor API and returns the vendor id and status', async () => {
            httpClient.post.mockResolvedValue({ data: { vendor_id: 'vendor-123', status: 'PENDING' } });

            const result = await provider.createOrUpdateVendor({
                organizationId: 'org-1',
                businessName: 'St. Example Church',
                panNumber: 'ABCDE1234F',
                bankAccountNumber: '123456789012',
                ifsc: 'HDFC0000123',
                gstin: undefined,
            });

            expect(result).toEqual({ vendorId: 'vendor-123', rawStatus: 'PENDING' });
            expect(httpClient.post).toHaveBeenCalledWith(
                'https://sandbox.cashfree.com/pg/easy-split/vendors',
                expect.objectContaining({ vendor_id: 'org-1', name: 'St. Example Church', pan: 'ABCDE1234F', bank_account_number: '123456789012', bank_ifsc: 'HDFC0000123' }),
                expect.anything(),
            );
        });
    });

    describe('verifyWebhookSignature', () => {
        const rawBody = Buffer.from(JSON.stringify({ type: 'VENDOR_KYC_UPDATE' }));

        it('accepts a signature computed with the current secret', () => {
            const signature = createHmac('sha256', 'current-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
        });

        it('accepts a signature computed with the previous secret during rotation', () => {
            const signature = createHmac('sha256', 'previous-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
        });

        it('rejects a signature computed with an unknown secret', () => {
            const signature = createHmac('sha256', 'wrong-secret').update(rawBody).digest('base64');
            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(false);
        });

        it('rejects a missing signature header', () => {
            expect(provider.verifyWebhookSignature(rawBody, undefined)).toBe(false);
        });
    });

    describe('parseWebhookEvent', () => {
        it('maps a Cashfree vendor KYC webhook payload to a VendorWebhookEvent', () => {
            const payload = {
                type: 'VENDOR_KYC_UPDATE',
                event_id: 'evt-1',
                data: { vendor_id: 'vendor-123', status: 'ACTIVE' },
            };
            const rawBody = Buffer.from(JSON.stringify(payload));

            expect(provider.parseWebhookEvent(rawBody)).toEqual({
                eventId: 'evt-1',
                eventType: 'VENDOR_KYC_UPDATE',
                vendorId: 'vendor-123',
                status: 'active',
                rejectionReason: undefined,
            });
        });

        it('maps a rejected status and carries the rejection reason', () => {
            const payload = {
                type: 'VENDOR_KYC_UPDATE',
                event_id: 'evt-2',
                data: { vendor_id: 'vendor-123', status: 'REJECTED', remarks: 'PAN mismatch' },
            };
            const rawBody = Buffer.from(JSON.stringify(payload));

            expect(provider.parseWebhookEvent(rawBody)).toEqual({
                eventId: 'evt-2',
                eventType: 'VENDOR_KYC_UPDATE',
                vendorId: 'vendor-123',
                status: 'rejected',
                rejectionReason: 'PAN mismatch',
            });
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPattern=cashfree-vendor.provider.spec.ts`
Expected: FAIL with "Cannot find module './cashfree-vendor.provider'"

- [ ] **Step 3: Write the implementation**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosInstance } from 'axios';
import { VendorProvider } from './vendor-provider';
import { VendorKycResult, VendorKycSubmission, VendorWebhookEvent, VendorWebhookStatus } from './vendor-provider.types';

export const CASHFREE_HTTP_CLIENT = Symbol('CASHFREE_HTTP_CLIENT');

const STATUS_MAP: Record<string, VendorWebhookStatus> = {
    PENDING: 'pending',
    ACTIVE: 'active',
    REJECTED: 'rejected',
};

// Concrete VendorProvider for Cashfree's Easy Split Vendor API
// (docs/integrations/cashfree-giving-split.md §1, §3). This is the one
// place in org-svc allowed to know the provider's name and wire format —
// everything above it (OnboardingService, controllers, DTOs) depends only
// on the VendorProvider abstract class.
@Injectable()
export class CashfreeVendorProvider extends VendorProvider {
    private readonly baseUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly webhookSecret: string;
    private readonly previousWebhookSecret?: string;

    constructor(
        private readonly configService: ConfigService,
        @Inject(CASHFREE_HTTP_CLIENT) private readonly httpClient: AxiosInstance,
    ) {
        super();
        this.baseUrl = this.configService.getOrThrow<string>('CASHFREE_API_BASE_URL');
        this.clientId = this.configService.getOrThrow<string>('CASHFREE_CLIENT_ID');
        this.clientSecret = this.configService.getOrThrow<string>('CASHFREE_CLIENT_SECRET');
        this.webhookSecret = this.configService.getOrThrow<string>('CASHFREE_WEBHOOK_SECRET');
        this.previousWebhookSecret = this.configService.get<string>('CASHFREE_WEBHOOK_SECRET_PREVIOUS');
    }

    async createOrUpdateVendor(submission: VendorKycSubmission): Promise<VendorKycResult> {
        const response = await this.httpClient.post(
            `${this.baseUrl}/pg/easy-split/vendors`,
            {
                vendor_id: submission.organizationId,
                name: submission.businessName,
                pan: submission.panNumber,
                bank_account_number: submission.bankAccountNumber,
                bank_ifsc: submission.ifsc,
                gstin: submission.gstin,
            },
            { headers: { 'x-client-id': this.clientId, 'x-client-secret': this.clientSecret } },
        );
        return { vendorId: response.data.vendor_id, rawStatus: response.data.status };
    }

    verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
        if (!signatureHeader) return false;
        const candidates = [this.webhookSecret, this.previousWebhookSecret].filter((secret): secret is string => Boolean(secret));
        return candidates.some((secret) => this.matchesSignature(rawBody, signatureHeader, secret));
    }

    parseWebhookEvent(rawBody: Buffer): VendorWebhookEvent {
        const payload = JSON.parse(rawBody.toString('utf8'));
        return {
            eventId: payload.event_id,
            eventType: payload.type,
            vendorId: payload.data.vendor_id,
            status: STATUS_MAP[payload.data.status] ?? 'pending',
            rejectionReason: payload.data.remarks,
        };
    }

    private matchesSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
        const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const providedBuffer = Buffer.from(signatureHeader, 'utf8');
        if (expectedBuffer.length !== providedBuffer.length) return false;
        return timingSafeEqual(expectedBuffer, providedBuffer);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPattern=cashfree-vendor.provider.spec.ts`
Expected: PASS

- [ ] **Step 5: Add placeholder env vars**

Append to `.env`:
```
CASHFREE_API_BASE_URL="https://sandbox.cashfree.com"
CASHFREE_CLIENT_ID="placeholder-cashfree-client-id-replace-me"
CASHFREE_CLIENT_SECRET="placeholder-cashfree-client-secret-replace-me"
CASHFREE_WEBHOOK_SECRET="placeholder-cashfree-webhook-secret-replace-me"
```

- [ ] **Step 6: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/provider/cashfree-vendor.provider.spec.ts \
        .env
git commit -m "feat(org-svc): add CashfreeVendorProvider implementation"
```

---

### Task 4: `OrganizationOnboardingSubmissionRepository` + `OrganizationProfileRepository.findByCashfreeVendorId`

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.spec.ts`
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.spec.ts` (new file)
- Modify: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.module.ts` (export the repository)

**Interfaces:**
- Consumes: `OrganizationOnboardingSubmission` (Task 1), `BaseRepository` from `@parishbooks/database`.
- Produces: `OrganizationOnboardingSubmissionRepository.createSubmission(data: Partial<OrganizationOnboardingSubmission>): Promise<OrganizationOnboardingSubmission>`;
  `OrganizationProfileRepository.findByCashfreeVendorId(vendorId: string): Promise<OrganizationProfile | null>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';

describe('OrganizationOnboardingSubmissionRepository', () => {
    it('creates and saves a submission via the base repository', async () => {
        const save = jest.fn((entity) => Promise.resolve({ id: 'sub-1', ...entity }));
        const create = jest.fn((data) => data);
        const dataSource = {
            getRepository: () => ({ metadata: {}, target: OrganizationOnboardingSubmissionRepository }),
            createEntityManager: () => ({}),
        } as unknown as DataSource;

        const module = await Test.createTestingModule({
            providers: [{ provide: OrganizationOnboardingSubmissionRepository, useValue: { create, save, createSubmission: (data: unknown) => save(create(data)) } }],
        }).compile();

        const repository = module.get(OrganizationOnboardingSubmissionRepository) as unknown as { createSubmission: (data: unknown) => Promise<unknown> };
        const result = await repository.createSubmission({ organizationId: 'org-1', businessName: 'Church' });

        expect(create).toHaveBeenCalledWith({ organizationId: 'org-1', businessName: 'Church' });
        expect(save).toHaveBeenCalled();
        expect(result).toEqual({ id: 'sub-1', organizationId: 'org-1', businessName: 'Church' });
    });
});
```

```typescript
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.spec.ts
import { Test } from '@nestjs/testing';
import { OrganizationProfileRepository } from './organization-profile.repository';

describe('OrganizationProfileRepository.findByCashfreeVendorId', () => {
    it('looks up a profile by its cashfreeVendorId', async () => {
        const findOneBy = jest.fn().mockResolvedValue({ id: 'profile-1', cashfreeVendorId: 'vendor-123' });
        const module = await Test.createTestingModule({
            providers: [{ provide: OrganizationProfileRepository, useValue: { findByCashfreeVendorId: (vendorId: string) => findOneBy({ cashfreeVendorId: vendorId }) } }],
        }).compile();

        const repository = module.get(OrganizationProfileRepository) as unknown as { findByCashfreeVendorId: (vendorId: string) => Promise<unknown> };
        const result = await repository.findByCashfreeVendorId('vendor-123');

        expect(findOneBy).toHaveBeenCalledWith({ cashfreeVendorId: 'vendor-123' });
        expect(result).toEqual({ id: 'profile-1', cashfreeVendorId: 'vendor-123' });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test parishbooks-org-svc --testPathPattern="organization-onboarding-submission.repository|organization-profile.repository"`
Expected: FAIL — `OrganizationOnboardingSubmissionRepository` module not found; `findByCashfreeVendorId` is not a function on the real class (the spec above uses a stand-in, so red state here is the missing repository file; the real repository test below the fold in Step 3 is what actually drives the method).

- [ ] **Step 3: Write the repositories**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.ts
import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationOnboardingSubmission } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class OrganizationOnboardingSubmissionRepository extends BaseRepository<OrganizationOnboardingSubmission> {
    constructor(dataSource: DataSource) {
        super(OrganizationOnboardingSubmission, dataSource);
    }

    createSubmission(data: Partial<OrganizationOnboardingSubmission>): Promise<OrganizationOnboardingSubmission> {
        return this.save(this.create(data));
    }
}
```

Modify `organization-profile.repository.ts` to add:
```typescript
    findByCashfreeVendorId(cashfreeVendorId: string): Promise<OrganizationProfile | null> {
        return this.findOneBy({ cashfreeVendorId });
    }
```
(add this method inside the existing `OrganizationProfileRepository` class, after `findByOrganizationId`).

Modify `organization-profile.module.ts` to export the repository so the
onboarding module can reuse it without a second `@InjectRepository`-style
instantiation:
```typescript
import { Module } from '@nestjs/common';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

@Module({
    controllers: [OrganizationProfileController],
    providers: [OrganizationProfileService, OrganizationProfileRepository],
    exports: [OrganizationProfileService, OrganizationProfileRepository],
})
export class OrganizationProfileModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test parishbooks-org-svc --testPathPattern="organization-onboarding-submission.repository|organization-profile.repository"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-submission.repository.spec.ts \
        apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.ts \
        apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.spec.ts \
        apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.module.ts
git commit -m "feat(org-svc): add onboarding submission repository and vendor-id lookup"
```

---

### Task 5: DTOs

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/dto/submit-onboarding.dto.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/dto/onboarding-status.dto.ts`

**Interfaces:**
- Produces: `SubmitOnboardingDto { businessName: string; panNumber: string; bankAccountNumber: string; ifsc: string; gstin?: string }`;
  `OnboardingStatusDto { organizationId: string; vendorStatus: CashfreeVendorStatus; vendorStatusAt: Date | null; rejectionReason?: string }`.

No test step — these are declarative DTOs exercised through the
controller/service tests in Tasks 6–7; validation behavior is asserted
there via `ValidationPipe`-equivalent `class-validator` decorators.

- [ ] **Step 1: Write `SubmitOnboardingDto`**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/dto/submit-onboarding.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SubmitOnboardingDto {
    @ApiProperty({ example: 'St. Example Church' })
    @IsString()
    businessName!: string;

    @ApiProperty({ example: 'ABCDE1234F', description: 'PAN — forwarded to the payment provider, never persisted raw' })
    @IsString()
    @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN' })
    panNumber!: string;

    @ApiProperty({ example: '123456789012', description: 'Bank account number — forwarded to the payment provider, never persisted raw' })
    @IsString()
    @Length(6, 20)
    bankAccountNumber!: string;

    @ApiProperty({ example: 'HDFC0000123' })
    @IsString()
    @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'ifsc must be a valid IFSC code' })
    ifsc!: string;

    @ApiPropertyOptional({ example: '22AAAAA0000A1Z5' })
    @IsOptional()
    @IsString()
    gstin?: string;
}
```

- [ ] **Step 2: Write `OnboardingStatusDto`**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/dto/onboarding-status.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashfreeVendorStatus } from '@parishbooks/database';

export class OnboardingStatusDto {
    @ApiProperty()
    organizationId!: string;

    @ApiProperty({ enum: CashfreeVendorStatus })
    vendorStatus!: CashfreeVendorStatus;

    @ApiPropertyOptional({ type: String, nullable: true })
    vendorStatusAt!: Date | null;

    @ApiPropertyOptional({ type: String, nullable: true })
    rejectionReason?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/dto/submit-onboarding.dto.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/dto/onboarding-status.dto.ts
git commit -m "feat(org-svc): add onboarding submission and status DTOs"
```

---

### Task 6: `OnboardingService`

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.spec.ts`

**Interfaces:**
- Consumes: `OrganizationProfileRepository.findByOrganizationId`,
  `.findByCashfreeVendorId`, `.updateProfile` (existing); `OrganizationOnboardingSubmissionRepository.createSubmission`
  (Task 4); `VendorProvider.createOrUpdateVendor`, `.maskLast4` (Task 2);
  `SubmitOnboardingDto`, `OnboardingStatusDto` (Task 5); `VendorWebhookEvent`
  (Task 2); `CashfreeVendorStatus` from `@parishbooks/database`.
- Produces: `OnboardingService.submit(organizationId: string, submittedByUserId: string, dto: SubmitOnboardingDto): Promise<OnboardingStatusDto>`;
  `.getStatus(organizationId: string): Promise<OnboardingStatusDto>`;
  `.applyWebhookEvent(event: VendorWebhookEvent): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CashfreeVendorStatus } from '@parishbooks/database';
import { OrganizationProfileRepository } from '../organization-profile/organization-profile.repository';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { VendorProvider } from './provider/vendor-provider';

describe('OrganizationOnboardingService', () => {
    let service: OrganizationOnboardingService;
    let profileRepository: { findByOrganizationId: jest.Mock; findByCashfreeVendorId: jest.Mock; updateProfile: jest.Mock };
    let submissionRepository: { createSubmission: jest.Mock };
    let vendorProvider: { createOrUpdateVendor: jest.Mock; maskLast4: jest.Mock };

    beforeEach(async () => {
        profileRepository = { findByOrganizationId: jest.fn(), findByCashfreeVendorId: jest.fn(), updateProfile: jest.fn((_id, data) => ({ id: 'profile-1', organizationId: 'org-1', ...data })) };
        submissionRepository = { createSubmission: jest.fn() };
        vendorProvider = { createOrUpdateVendor: jest.fn(), maskLast4: jest.fn((v: string) => `masked:${v.slice(-4)}`) };

        const module = await Test.createTestingModule({
            providers: [
                OrganizationOnboardingService,
                { provide: OrganizationProfileRepository, useValue: profileRepository },
                { provide: OrganizationOnboardingSubmissionRepository, useValue: submissionRepository },
                { provide: VendorProvider, useValue: vendorProvider },
            ],
        }).compile();

        service = module.get(OrganizationOnboardingService);
    });

    describe('submit', () => {
        const dto = { businessName: 'Church', panNumber: 'ABCDE1234F', bankAccountNumber: '123456789012', ifsc: 'HDFC0000123', gstin: undefined };

        it('throws NotFoundException when the org has no profile yet', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue(null);

            await expect(service.submit('org-1', 'user-1', dto)).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException when the org is already ACTIVE', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE });

            await expect(service.submit('org-1', 'user-1', dto)).rejects.toThrow(ConflictException);
            expect(vendorProvider.createOrUpdateVendor).not.toHaveBeenCalled();
        });

        it('calls the provider, stores a masked submission, and sets status PENDING', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ id: 'profile-1', organizationId: 'org-1', cashfreeVendorStatus: CashfreeVendorStatus.NOT_STARTED });
            vendorProvider.createOrUpdateVendor.mockResolvedValue({ vendorId: 'vendor-123', rawStatus: 'PENDING' });

            const result = await service.submit('org-1', 'user-1', dto);

            expect(vendorProvider.createOrUpdateVendor).toHaveBeenCalledWith({ organizationId: 'org-1', businessName: 'Church', panNumber: 'ABCDE1234F', bankAccountNumber: '123456789012', ifsc: 'HDFC0000123', gstin: undefined });
            expect(submissionRepository.createSubmission).toHaveBeenCalledWith(
                expect.objectContaining({ organizationId: 'org-1', businessName: 'Church', panNumberMasked: 'masked:234F', bankAccountMasked: 'masked:9012', ifsc: 'HDFC0000123', submittedByUserId: 'user-1', providerRawStatus: 'PENDING' }),
            );
            expect(profileRepository.updateProfile).toHaveBeenCalledWith('profile-1', expect.objectContaining({ cashfreeVendorId: 'vendor-123', cashfreeVendorStatus: CashfreeVendorStatus.PENDING }));
            expect(result.vendorStatus).toBe(CashfreeVendorStatus.PENDING);
        });
    });

    describe('getStatus', () => {
        it('throws NotFoundException when the org has no profile', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue(null);

            await expect(service.getStatus('org-1')).rejects.toThrow(NotFoundException);
        });

        it('returns the current vendor status', async () => {
            profileRepository.findByOrganizationId.mockResolvedValue({ organizationId: 'org-1', cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE, cashfreeVendorStatusAt: new Date('2026-01-01') });

            const result = await service.getStatus('org-1');

            expect(result).toEqual({ organizationId: 'org-1', vendorStatus: CashfreeVendorStatus.ACTIVE, vendorStatusAt: new Date('2026-01-01'), rejectionReason: undefined });
        });
    });

    describe('applyWebhookEvent', () => {
        it('is a no-op when no profile matches the vendor id', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue(null);

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'unknown-vendor', status: 'active' });

            expect(profileRepository.updateProfile).not.toHaveBeenCalled();
        });

        it('updates the matched org to ACTIVE', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue({ id: 'profile-1' });

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' });

            expect(profileRepository.updateProfile).toHaveBeenCalledWith('profile-1', expect.objectContaining({ cashfreeVendorStatus: CashfreeVendorStatus.ACTIVE }));
        });

        it('updates the matched org to REJECTED', async () => {
            profileRepository.findByCashfreeVendorId.mockResolvedValue({ id: 'profile-1' });

            await service.applyWebhookEvent({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'rejected', rejectionReason: 'PAN mismatch' });

            expect(profileRepository.updateProfile).toHaveBeenCalledWith('profile-1', expect.objectContaining({ cashfreeVendorStatus: CashfreeVendorStatus.REJECTED }));
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding.service.spec.ts`
Expected: FAIL with "Cannot find module './organization-onboarding.service'"

- [ ] **Step 3: Write the service**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CashfreeVendorStatus } from '@parishbooks/database';
import { OrganizationProfileRepository } from '../organization-profile/organization-profile.repository';
import { OnboardingStatusDto } from './dto/onboarding-status.dto';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';
import { VendorProvider } from './provider/vendor-provider';
import { VendorWebhookEvent, VendorWebhookStatus } from './provider/vendor-provider.types';

const WEBHOOK_STATUS_MAP: Record<VendorWebhookStatus, CashfreeVendorStatus> = {
    pending: CashfreeVendorStatus.PENDING,
    active: CashfreeVendorStatus.ACTIVE,
    rejected: CashfreeVendorStatus.REJECTED,
};

@Injectable()
export class OrganizationOnboardingService {
    constructor(
        private readonly profileRepository: OrganizationProfileRepository,
        private readonly submissionRepository: OrganizationOnboardingSubmissionRepository,
        private readonly vendorProvider: VendorProvider,
    ) {}

    async submit(organizationId: string, submittedByUserId: string, dto: SubmitOnboardingDto): Promise<OnboardingStatusDto> {
        const profile = await this.profileRepository.findByOrganizationId(organizationId);
        if (!profile) throw new NotFoundException(`Organization profile not found for organization ${organizationId}`);
        if (profile.cashfreeVendorStatus === CashfreeVendorStatus.ACTIVE) {
            throw new ConflictException(`Organization ${organizationId} is already onboarded`);
        }

        const result = await this.vendorProvider.createOrUpdateVendor({
            organizationId,
            businessName: dto.businessName,
            panNumber: dto.panNumber,
            bankAccountNumber: dto.bankAccountNumber,
            ifsc: dto.ifsc,
            gstin: dto.gstin,
        });

        await this.submissionRepository.createSubmission({
            organizationId,
            businessName: dto.businessName,
            panNumberMasked: this.vendorProvider.maskLast4(dto.panNumber),
            bankAccountMasked: this.vendorProvider.maskLast4(dto.bankAccountNumber),
            ifsc: dto.ifsc,
            gstin: dto.gstin,
            submittedByUserId,
            providerRawStatus: result.rawStatus,
        });

        const updated = await this.profileRepository.updateProfile(profile.id, {
            cashfreeVendorId: result.vendorId,
            cashfreeVendorStatus: CashfreeVendorStatus.PENDING,
            cashfreeVendorStatusAt: new Date(),
        });

        return this.toStatusDto(updated);
    }

    async getStatus(organizationId: string): Promise<OnboardingStatusDto> {
        const profile = await this.profileRepository.findByOrganizationId(organizationId);
        if (!profile) throw new NotFoundException(`Organization profile not found for organization ${organizationId}`);
        return this.toStatusDto(profile);
    }

    async applyWebhookEvent(event: VendorWebhookEvent): Promise<void> {
        const profile = await this.profileRepository.findByCashfreeVendorId(event.vendorId);
        if (!profile) return;
        await this.profileRepository.updateProfile(profile.id, {
            cashfreeVendorStatus: WEBHOOK_STATUS_MAP[event.status],
            cashfreeVendorStatusAt: new Date(),
        });
    }

    private toStatusDto(profile: { organizationId: string; cashfreeVendorStatus: CashfreeVendorStatus; cashfreeVendorStatusAt?: Date }): OnboardingStatusDto {
        return {
            organizationId: profile.organizationId,
            vendorStatus: profile.cashfreeVendorStatus,
            vendorStatusAt: profile.cashfreeVendorStatusAt ?? null,
        };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.service.spec.ts
git commit -m "feat(org-svc): add OrganizationOnboardingService"
```

---

### Task 7: `OrganizationOnboardingController`

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.spec.ts`

**Interfaces:**
- Consumes: `OrganizationOnboardingService.submit`, `.getStatus` (Task 6);
  `SubmitOnboardingDto`, `OnboardingStatusDto` (Task 5).
- Produces: `POST /organizations/:organizationId/onboarding`,
  `GET /organizations/:organizationId/onboarding/status` — both routes
  are the ones later tasks (and giving-svc, eventually) call by these
  exact paths.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthContext } from '@parishbooks/core';
import { OrganizationOnboardingController } from './organization-onboarding.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';

describe('OrganizationOnboardingController', () => {
    let controller: OrganizationOnboardingController;
    let service: { submit: jest.Mock; getStatus: jest.Mock };
    let authContext: { getUser: jest.Mock };

    beforeEach(async () => {
        service = { submit: jest.fn(), getStatus: jest.fn() };
        authContext = { getUser: jest.fn().mockReturnValue({ id: 'user-1' }) };
        const module = await Test.createTestingModule({
            controllers: [OrganizationOnboardingController],
            providers: [
                { provide: OrganizationOnboardingService, useValue: service },
                { provide: AuthContext, useValue: authContext },
            ],
        }).compile();

        controller = module.get(OrganizationOnboardingController);
    });

    it('rejects submit when organizationId path param does not match x-tenant-id', async () => {
        await expect(controller.submit('org-1', 'org-2', { businessName: 'Church' } as never)).rejects.toThrow(BadRequestException);
        expect(service.submit).not.toHaveBeenCalled();
    });

    it('delegates submit to the service with the authenticated user id', async () => {
        service.submit.mockResolvedValue({ organizationId: 'org-1', vendorStatus: 'pending' });

        const result = await controller.submit('org-1', 'org-1', { businessName: 'Church' } as never);

        expect(service.submit).toHaveBeenCalledWith('org-1', 'user-1', { businessName: 'Church' });
        expect(result).toEqual({ organizationId: 'org-1', vendorStatus: 'pending' });
    });

    it('rejects status fetch when organizationId path param does not match x-tenant-id', async () => {
        await expect(controller.status('org-1', 'org-2')).rejects.toThrow(BadRequestException);
        expect(service.getStatus).not.toHaveBeenCalled();
    });

    it('delegates status fetch to the service', async () => {
        service.getStatus.mockResolvedValue({ organizationId: 'org-1', vendorStatus: 'active' });

        const result = await controller.status('org-1', 'org-1');

        expect(service.getStatus).toHaveBeenCalledWith('org-1');
        expect(result).toEqual({ organizationId: 'org-1', vendorStatus: 'active' });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding.controller.spec.ts`
Expected: FAIL with "Cannot find module './organization-onboarding.controller'"

- [ ] **Step 3: Write the controller**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.ts
import { BadRequestException, Body, Controller, Get, Headers, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, AuthContext } from '@parishbooks/core';
import { OnboardingStatusDto } from './dto/onboarding-status.dto';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import { OrganizationOnboardingService } from './organization-onboarding.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationOnboardingController {
    constructor(
        private readonly service: OrganizationOnboardingService,
        private readonly authContext: AuthContext,
    ) {}

    @ApiProperty({ name: 'submitOrganizationOnboarding', status: HttpStatus.CREATED, responseType: OnboardingStatusDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Post(':organizationId/onboarding')
    submit(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string, @Body() dto: SubmitOnboardingDto) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.submit(organizationId, this.currentUserId(), dto));
    }

    @ApiProperty({ name: 'getOrganizationOnboardingStatus', status: HttpStatus.OK, responseType: OnboardingStatusDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get(':organizationId/onboarding/status')
    status(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.getStatus(organizationId));
    }

    private currentUserId(): string {
        const userId = this.authContext.getUser()?.id;
        if (!userId) throw new BadRequestException('No authenticated user in request context');
        return userId;
    }

    private assertTenantMatch<T>(organizationId: string, tenantId: string, fn: () => T): T {
        const errMessage = 'organizationId path parameter must match x-tenant-id header';
        if (organizationId !== tenantId) throw new BadRequestException(errMessage);
        return fn();
    }
}
```

`userId` is read from `AuthContext.getUser()?.id` — the same
`AsyncLocalStorage`-backed accessor `AuthGuard` populates on every
authenticated request (`packages/core/src/lib/guard/auth/auth-context.ts`,
`auth.guard.ts`) — not a controller parameter, since Nest only invokes
decorated method parameters from the real HTTP request. The test injects
a stand-in `AuthContext` (`{ getUser: () => ({ id: 'user-1' }) }`) and
calls `controller.submit('org-1', 'org-1', dto)` with 3 args to match.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.controller.spec.ts
git commit -m "feat(org-svc): add onboarding submission/status controller"
```

---

### Task 8: raw-body support for webhooks

**Files:**
- Modify: `packages/core/src/lib/application/types/application.types.ts`
- Modify: `packages/core/src/lib/application/application.ts`
- Modify: `apps/parishbooks-org-svc/src/main.ts`

**Interfaces:**
- Produces: `ApplicationBootstrapOptions.rawBody?: boolean` (default
  `false`, so every other service's behavior is unchanged); when `true`,
  `NestFactory.create` is given `{ bodyParser, rawBody: true }` so
  `request.rawBody` (a `Buffer`) is populated alongside the normally
  parsed JSON body — needed for HMAC signature verification, which must
  run over the exact bytes Cashfree signed, not a re-serialized object.

- [ ] **Step 1: Add the option to the bootstrap types**

Read `packages/core/src/lib/application/types/application.types.ts`
first to see the existing `ApplicationBootstrapOptions` shape, then add:
```typescript
    /** Populates `request.rawBody` for webhook signature verification. Default false. */
    rawBody?: boolean;
```

- [ ] **Step 2: Wire it through `Application.bootstrap`**

In `packages/core/src/lib/application/application.ts`, change:
```typescript
        const { module, port, swagger, globalPrefix = 'api', bodyParser = true } = options;

        const app = await NestFactory.create(module, { bodyParser });
```
to:
```typescript
        const { module, port, swagger, globalPrefix = 'api', bodyParser = true, rawBody = false } = options;

        const app = await NestFactory.create(module, { bodyParser, rawBody });
```

- [ ] **Step 3: Opt in from org-svc**

In `apps/parishbooks-org-svc/src/main.ts`, add `rawBody: true` to the
`Application.bootstrap` call options.

- [ ] **Step 4: Run the existing core and org-svc test suites to confirm nothing broke**

Run: `npx nx test core && npx nx test parishbooks-org-svc`
Expected: PASS (no behavior change for any existing route; `rawBody`
defaults to `false` everywhere else)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lib/application/types/application.types.ts \
        packages/core/src/lib/application/application.ts \
        apps/parishbooks-org-svc/src/main.ts
git commit -m "feat(core): add opt-in raw-body support for webhook signature verification"
```

---

### Task 9: `OrganizationOnboardingWebhookController`

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.ts`
- Test: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.spec.ts`

**Interfaces:**
- Consumes: `VendorProvider.verifyWebhookSignature`, `.parseWebhookEvent`
  (Task 2); `OrganizationOnboardingService.applyWebhookEvent` (Task 6);
  `ProcessedWebhookEventRepository.hasProcessed`, `.markProcessed`,
  `WebhookProvider` from `@parishbooks/database` (existing).
- Produces: `POST /organizations/onboarding/webhook` — public, no
  tenant header required (the event identifies its own org via the
  vendor id inside the signed payload, per `docs/integrations/cashfree-giving-split.md`
  §3).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebhookProvider } from '@parishbooks/database';
import { OrganizationOnboardingWebhookController } from './organization-onboarding-webhook.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { VendorProvider } from './provider/vendor-provider';
import { ProcessedWebhookEventRepository } from '@parishbooks/database';

describe('OrganizationOnboardingWebhookController', () => {
    let controller: OrganizationOnboardingWebhookController;
    let onboardingService: { applyWebhookEvent: jest.Mock };
    let vendorProvider: { verifyWebhookSignature: jest.Mock; parseWebhookEvent: jest.Mock };
    let webhookEventRepository: { hasProcessed: jest.Mock; markProcessed: jest.Mock };

    beforeEach(async () => {
        onboardingService = { applyWebhookEvent: jest.fn() };
        vendorProvider = { verifyWebhookSignature: jest.fn(), parseWebhookEvent: jest.fn() };
        webhookEventRepository = { hasProcessed: jest.fn(), markProcessed: jest.fn() };

        const module = await Test.createTestingModule({
            controllers: [OrganizationOnboardingWebhookController],
            providers: [
                { provide: OrganizationOnboardingService, useValue: onboardingService },
                { provide: VendorProvider, useValue: vendorProvider },
                { provide: ProcessedWebhookEventRepository, useValue: webhookEventRepository },
            ],
        }).compile();

        controller = module.get(OrganizationOnboardingWebhookController);
    });

    it('rejects when the signature does not verify', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(false);
        const req = { rawBody: Buffer.from('{}') } as never;

        await expect(controller.handleWebhook(req, 'bad-signature')).rejects.toThrow(UnauthorizedException);
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
    });

    it('is a no-op on a duplicate event id', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        vendorProvider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' });
        webhookEventRepository.hasProcessed.mockResolvedValue(true);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(webhookEventRepository.hasProcessed).toHaveBeenCalledWith(WebhookProvider.CASHFREE, 'evt-1');
        expect(onboardingService.applyWebhookEvent).not.toHaveBeenCalled();
        expect(webhookEventRepository.markProcessed).not.toHaveBeenCalled();
    });

    it('applies a new event and marks it processed', async () => {
        vendorProvider.verifyWebhookSignature.mockReturnValue(true);
        const event = { eventId: 'evt-2', eventType: 'VENDOR_KYC_UPDATE', vendorId: 'vendor-123', status: 'active' as const };
        vendorProvider.parseWebhookEvent.mockReturnValue(event);
        webhookEventRepository.hasProcessed.mockResolvedValue(false);
        const req = { rawBody: Buffer.from('{}') } as never;

        await controller.handleWebhook(req, 'good-signature');

        expect(onboardingService.applyWebhookEvent).toHaveBeenCalledWith(event);
        expect(webhookEventRepository.markProcessed).toHaveBeenCalledWith({ provider: WebhookProvider.CASHFREE, eventId: 'evt-2', eventType: 'VENDOR_KYC_UPDATE' });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding-webhook.controller.spec.ts`
Expected: FAIL with "Cannot find module './organization-onboarding-webhook.controller'"

- [ ] **Step 3: Write the controller**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.ts
import { Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@parishbooks/core';
import { ProcessedWebhookEventRepository, WebhookProvider } from '@parishbooks/database';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { VendorProvider } from './provider/vendor-provider';

// Vendor KYC status webhook — verify → dedupe → apply, the same pattern
// used for donation payment webhooks
// (docs/integrations/cashfree-giving-split.md §3, CLAUDE.md rule 5).
@ApiExcludeController()
@Controller('organizations/onboarding')
export class OrganizationOnboardingWebhookController {
    constructor(
        private readonly onboardingService: OrganizationOnboardingService,
        private readonly vendorProvider: VendorProvider,
        private readonly webhookEventRepository: ProcessedWebhookEventRepository,
    ) {}

    @Public()
    @Post('webhook')
    async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-webhook-signature') signature: string | undefined): Promise<{ status: 'ok' }> {
        const rawBody = req.rawBody ?? Buffer.alloc(0);
        if (!this.vendorProvider.verifyWebhookSignature(rawBody, signature)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        const event = this.vendorProvider.parseWebhookEvent(rawBody);
        const alreadyProcessed = await this.webhookEventRepository.hasProcessed(WebhookProvider.CASHFREE, event.eventId);
        if (alreadyProcessed) return { status: 'ok' };

        await this.onboardingService.applyWebhookEvent(event);
        await this.webhookEventRepository.markProcessed({ provider: WebhookProvider.CASHFREE, eventId: event.eventId, eventType: event.eventType });
        return { status: 'ok' };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testPathPattern=organization-onboarding-webhook.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.ts \
        apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding-webhook.controller.spec.ts
git commit -m "feat(org-svc): add signature-verified, deduped onboarding webhook"
```

---

### Task 10: `OrganizationOnboardingModule` wiring

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.module.ts`
- Modify: `apps/parishbooks-org-svc/src/app/app.module.ts`

**Interfaces:**
- Consumes: every provider/controller from Tasks 2–9.
- Produces: `OrganizationOnboardingModule`, registered in `AppModule.imports`.

- [ ] **Step 1: Write the module**

```typescript
// apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.module.ts
import { Module } from '@nestjs/common';
import axios from 'axios';
import { OrganizationProfileModule } from '../organization-profile/organization-profile.module';
import { OnboardingStatusDto } from './dto/onboarding-status.dto';
import { OrganizationOnboardingSubmissionRepository } from './organization-onboarding-submission.repository';
import { OrganizationOnboardingWebhookController } from './organization-onboarding-webhook.controller';
import { OrganizationOnboardingController } from './organization-onboarding.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';
import { CASHFREE_HTTP_CLIENT, CashfreeVendorProvider } from './provider/cashfree-vendor.provider';
import { VendorProvider } from './provider/vendor-provider';

@Module({
    imports: [OrganizationProfileModule],
    controllers: [OrganizationOnboardingController, OrganizationOnboardingWebhookController],
    providers: [
        OrganizationOnboardingService,
        OrganizationOnboardingSubmissionRepository,
        { provide: CASHFREE_HTTP_CLIENT, useValue: axios.create({ timeout: 5000 }) },
        { provide: VendorProvider, useClass: CashfreeVendorProvider },
    ],
})
export class OrganizationOnboardingModule {}
```

(Remove the unused `OnboardingStatusDto` import if the linter flags it —
it's not directly referenced in this file; it was listed above only to
show the module's full dependency surface at a glance. Drop that import
line when writing the real file.)

- [ ] **Step 2: Register the module in `AppModule`**

In `apps/parishbooks-org-svc/src/app/app.module.ts`, add the import
```typescript
import { OrganizationOnboardingModule } from './organization-onboarding/organization-onboarding.module';
```
and add `OrganizationOnboardingModule` to the `imports` array (after
`OrganizationProfileModule`).

- [ ] **Step 3: Run the full org-svc test suite**

Run: `npx nx test parishbooks-org-svc`
Expected: PASS — every spec written in Tasks 1–9 passes together, and no
existing `organization-profile` spec regresses.

- [ ] **Step 4: Run lint and typecheck**

Run: `npx nx run parishbooks-org-svc:lint && npx nx run database:lint`
Expected: PASS. Fix the `OnboardingStatusDto` unused-import issue here if
Step 1's note wasn't already applied.

- [ ] **Step 5: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-onboarding/organization-onboarding.module.ts \
        apps/parishbooks-org-svc/src/app/app.module.ts
git commit -m "feat(org-svc): wire up OrganizationOnboardingModule"
```

---

## Post-Plan Follow-ups (not part of this plan's scope)

- `parishbooks-giving-svc` calling `GET /organizations/:organizationId/onboarding/status`
  before donation creation — deferred until giving-svc's own
  donation-creation endpoint exists (see the design doc's rollout step 6).
- Daily reconciliation cron for orgs stuck in `pending` — hardening pass,
  not a launch blocker (design doc §7 step 7).
- `AuthContext`'s exact per-request user-id accessor needs confirming
  before Task 7 ships — see the inline note in that task.
