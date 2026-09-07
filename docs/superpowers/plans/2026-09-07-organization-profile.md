# OrganizationProfile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `OrganizationProfile` as the first business-owned entity in `packages/database`, serve it from a new endpoint in `parishbooks-org-svc`, and call that endpoint synchronously from `parishbooks-auth-svc` whenever a BetterAuth organization is created.

**Architecture:** `OrganizationProfile` extends `BaseEntity` (not `TenantEntity` — it represents the organization itself) with a unique `organizationId` column. `parishbooks-org-svc` gets a small `OrganizationProfileModule` (repository/service/controller) reusing the existing `AuthGuard`. `parishbooks-auth-svc`'s `AppService.createOrganization` calls that endpoint via the shared `HttpClientService`, forwarding the caller's bearer token and setting `x-tenant-id` to the new org's id, and awaits it in the same request — a failure there fails the whole `createOrganization` call.

**Tech Stack:** NestJS 11, TypeORM (Postgres, native `enum` columns), class-validator DTOs, `@parishbooks/core` (`AuthGuard`, `HttpClientService`, `Application.bootstrap`), `@parishbooks/database` (`BaseEntity`, `BaseRepository`, `DatabaseModule`).

**Spec:** `docs/superpowers/specs/2026-09-07-organization-profile-design.md`

## Global Constraints

- `synchronize: false` always — schema changes go through a committed migration (CLAUDE.md rule 3).
- Never trust a tenant/org id from the request body (CLAUDE.md rule 1) — the org-svc endpoint takes `organizationId` from the URL path and cross-checks it against the `x-tenant-id` header, never the body.
- Every inter-service call forwards the caller's Bearer token and `x-tenant-id` (CLAUDE.md rule 4) — no new service-credential mechanism is introduced.
- Every controller input is a class-validator DTO (`docs/architecture/api-conventions-error-handling.md`); the global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true`) is already wired via `Application.bootstrap` in every service's `main.ts`.
- PK is always `uuid` via `BaseEntity`'s `@PrimaryGeneratedColumn('uuid')`.
- Migration naming: `<unix-timestamp>-<PascalCaseDescription>.ts`, one logical schema change per migration (`docs/specs/typeorm-database-schema.md` §3).
- Integration tests hit a real Postgres — never mock the DB (`docs/quality-ops/testing-strategy.md` §1).

---

### Task 1: `OrganizationProfile` entity + migration

**Files:**
- Create: `packages/database/src/lib/entities/organization-profile.entity.ts`
- Create: `packages/database/src/lib/entities/organization-profile.entity.spec.ts`
- Modify: `packages/database/src/lib/entities/index.ts`
- Modify: `packages/database/src/index.ts`
- Create: `packages/database/src/lib/migration/<generated-timestamp>-CreateOrganizationProfile.ts`

**Interfaces:**
- Produces: `OrganizationProfile` class (`id: string`, `organizationId: string`, `country: OrganizationCountry`, `fcraRegistered: boolean`, `planTier: OrganizationPlanTier`, `timezone: string`, `currency: OrganizationCurrency`, `registrationNumber?: string`, `taxExemptionNumber80g?: string`, `ein?: string`, plus `createdAt`/`updatedAt`/`deletedAt` from `BaseEntity`), and enums `OrganizationCountry`, `OrganizationPlanTier`, `OrganizationCurrency` — all exported from `@parishbooks/database`. Later tasks import these.

- [ ] **Step 1: Write the entity**

```ts
// packages/database/src/lib/entities/organization-profile.entity.ts
import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

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

// 1:1 extension of BetterAuth's `organization` table. Not a TenantEntity —
// this row *is* the organization, not tenant-scoped data belonging to one.
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

- [ ] **Step 2: Export it from both barrels**

```ts
// packages/database/src/lib/entities/index.ts
export * from './base.entity';
export * from './tenant.entity';
export * from './organization-profile.entity';
```

```ts
// packages/database/src/index.ts — add these two lines after the existing entity exports
export * from './lib/entities/base.entity';
export * from './lib/entities/tenant.entity';
export * from './lib/entities/organization-profile.entity';

export * from './lib/repository/base.repository';
```

- [ ] **Step 3: Write the failing integration test**

```ts
// packages/database/src/lib/entities/organization-profile.entity.spec.ts
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OrganizationCountry, OrganizationCurrency, OrganizationPlanTier, OrganizationProfile } from './organization-profile.entity';

describe('OrganizationProfile (integration)', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [OrganizationProfile],
            synchronize: false,
        });
        await dataSource.initialize();
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    afterEach(async () => {
        await dataSource.getRepository(OrganizationProfile).delete({});
    });

    it('creates a profile with defaults applied', async () => {
        const repository = dataSource.getRepository(OrganizationProfile);

        const saved = await repository.save(repository.create({ organizationId: randomUUID(), timezone: 'Asia/Kolkata' }));

        expect(saved.id).toBeDefined();
        expect(saved.country).toBe(OrganizationCountry.IN);
        expect(saved.planTier).toBe(OrganizationPlanTier.STARTER);
        expect(saved.currency).toBe(OrganizationCurrency.INR);
        expect(saved.fcraRegistered).toBe(false);
    });

    it('rejects a second profile for the same organizationId', async () => {
        const repository = dataSource.getRepository(OrganizationProfile);
        const organizationId = randomUUID();
        await repository.save(repository.create({ organizationId, timezone: 'Asia/Kolkata' }));

        await expect(repository.save(repository.create({ organizationId, timezone: 'Asia/Kolkata' }))).rejects.toThrow();
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx nx test database --testFile=organization-profile.entity.spec.ts`
Expected: FAIL — the `organization_profile` table doesn't exist yet (`relation "organization_profile" does not exist`).

- [ ] **Step 5: Generate the migration**

```bash
export $(grep -v '^#' .env | xargs)
npx typeorm-ts-node-commonjs migration:generate -d packages/database/src/data-source.ts packages/database/src/lib/migration/CreateOrganizationProfile
```

This produces `packages/database/src/lib/migration/<timestamp>-CreateOrganizationProfile.ts`. Review the generated file against this checklist before committing (fix by hand if the generator gets any of these wrong):
- Creates three Postgres enum types (one per `country`/`planTier`/`currency` column) with the exact values `('IN','US')`, `('starter','pro')`, `('INR','USD')`.
- Creates table `organization_profile` with columns: `id` (uuid PK, default `uuid_generate_v4()` or `gen_random_uuid()` — whichever this TypeORM/Postgres version emits, matching what `BaseEntity`'s `@PrimaryGeneratedColumn('uuid')` already produces for any other future entity), `createdAt`/`updatedAt` (timestamptz, default now), `deletedAt` (timestamptz, nullable), `organizationId` (uuid, not null), `country`/`planTier`/`currency` (the enum types above, with the entity's defaults), `fcraRegistered` (boolean, default false), `timezone` (text, not null), `registrationNumber`/`taxExemptionNumber80g`/`ein` (text, nullable).
- A unique constraint/index on `organizationId`.
- `down()` reverses all of the above (drops the table, then the three enum types).

- [ ] **Step 6: Apply the migration locally**

```bash
export $(grep -v '^#' .env | xargs)
npx typeorm-ts-node-commonjs migration:run -d packages/database/src/data-source.ts
```

Expected: output lists the new migration as applied, no errors. Requires a local Postgres reachable at `DATABASE_URL` (per `docs/dx/getting-started.md`).

- [ ] **Step 7: Run the test again to verify it passes**

Run: `npx nx test database --testFile=organization-profile.entity.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/database/src/lib/entities/organization-profile.entity.ts \
        packages/database/src/lib/entities/organization-profile.entity.spec.ts \
        packages/database/src/lib/entities/index.ts \
        packages/database/src/index.ts \
        packages/database/src/lib/migration/
git commit -m "feat(database): add OrganizationProfile entity and migration"
```

---

### Task 2: Wire `parishbooks-org-svc`'s `AppModule`

**Files:**
- Modify: `apps/parishbooks-org-svc/package.json`
- Modify: `apps/parishbooks-org-svc/src/app/app.module.ts`
- Modify: `.env`

**Interfaces:**
- Consumes: `DatabaseModule` (`@parishbooks/database`), `AuthContext`/`AuthGuard`/`HttpClientModule`/`LoggerModule` (`@parishbooks/core`) — all existing, no signature changes.
- Produces: org-svc now has `DATABASE_URL`-backed TypeORM access and `AuthGuard` protecting every route by default. Task 4's `OrganizationProfileModule` import slot is left ready (added in Task 4, not here, to keep this task's build green without a forward reference to a module that doesn't exist yet).

- [ ] **Step 1: Add the `@parishbooks/database` dependency**

```json
// apps/parishbooks-org-svc/package.json — dependencies block
"dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "tslib": "^2.3.0",
    "@parishbooks/core": "workspace:*",
    "@parishbooks/database": "workspace:*"
},
```

- [ ] **Step 2: Install and sync**

```bash
bun install
npx nx sync
```

Expected: `bun install` links `@parishbooks/database` into `apps/parishbooks-org-svc/node_modules/@parishbooks`; `nx sync` updates TS project references (mirrors what happened when `@parishbooks/core` was added to this same app earlier — see `apps/parishbooks-org-svc/tsconfig.app.json`'s existing `references` array).

- [ ] **Step 3: Add `AUTH_SERVICE_URL` to `.env`**

```bash
# .env — add alongside the existing *_SERVICE_PORT block
AUTH_SERVICE_URL="http://localhost:3000"
```

`AuthGuard` (`packages/core/src/lib/guard/auth/auth.guard.ts`) reads this via `configService.getOrThrow('AUTH_SERVICE_URL')` to validate bearer tokens against auth-svc's `/api/identity/session`. It's required by every service that uses `AuthGuard`, and wasn't set anywhere yet — org-svc needs it now, so add it once here.

- [ ] **Step 4: Wire `AppModule`**

```ts
// apps/parishbooks-org-svc/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthContext, AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { DatabaseModule } from '@parishbooks/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
    ],
    controllers: [AppController],
    providers: [AppService, AuthContext, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
```

Note: `AuthContext` must be listed in `providers` alongside `AuthGuard` — `AuthGuard`'s own doc comment (`packages/core/src/lib/guard/auth/auth.guard.ts:14-16`) requires it, and omitting it causes a Nest DI resolution error at startup.

- [ ] **Step 5: Build and smoke-test**

Run: `npx nx build parishbooks-org-svc`
Expected: webpack compiles successfully.

Run: `npx nx serve parishbooks-org-svc` (then stop it after confirming)
Expected: Nest logs `DatabaseModule dependencies initialized`, `AppModule dependencies initialized`, and `Application is running on: http://localhost:3006/api` with no DI resolution errors. Stop the process (Ctrl+C) once confirmed.

- [ ] **Step 6: Commit**

```bash
git add apps/parishbooks-org-svc/package.json apps/parishbooks-org-svc/src/app/app.module.ts \
        apps/parishbooks-org-svc/tsconfig.app.json .env bun.lock tsconfig.json nx.json
git commit -m "feat(org-svc): wire DatabaseModule and AuthGuard into AppModule"
```

(The `tsconfig.app.json`/`tsconfig.json`/`nx.json` diffs come from `nx sync` in Step 2 — same mechanic as when `@parishbooks/core` was first added to this app.)

---

### Task 3: `OrganizationProfileRepository` + `OrganizationProfileService`

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.spec.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/dto/create-organization-profile.dto.ts`

**Interfaces:**
- Consumes: `BaseRepository<Entity>`, `OrganizationProfile`, `OrganizationPlanTier` (`@parishbooks/database`, from Task 1).
- Produces: `OrganizationProfileRepository.findByOrganizationId(organizationId: string): Promise<OrganizationProfile | null>`; `OrganizationProfileService.create(organizationId: string, dto: CreateOrganizationProfileDto): Promise<OrganizationProfile>` — Task 4's controller calls this exact signature.

- [ ] **Step 1: Write the DTO**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/dto/create-organization-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationCountry, OrganizationCurrency } from '@parishbooks/database';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationProfileDto {
    @ApiProperty({ example: 'Asia/Kolkata' })
    @IsString()
    timezone!: string;

    @ApiPropertyOptional({ enum: OrganizationCountry })
    @IsOptional()
    @IsIn(Object.values(OrganizationCountry))
    country?: OrganizationCountry;

    @ApiPropertyOptional({ enum: OrganizationCurrency })
    @IsOptional()
    @IsIn(Object.values(OrganizationCurrency))
    currency?: OrganizationCurrency;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    fcraRegistered?: boolean;

    @ApiPropertyOptional({ description: "Organization's registration number, printed on 80G receipts" })
    @IsOptional()
    @IsString()
    registrationNumber?: string;

    @ApiPropertyOptional({ description: '80G approval number' })
    @IsOptional()
    @IsString()
    taxExemptionNumber80g?: string;
}
```

- [ ] **Step 2: Write the repository**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.repository.ts
import { Injectable } from '@nestjs/common';
import { BaseRepository, OrganizationProfile } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class OrganizationProfileRepository extends BaseRepository<OrganizationProfile> {
    constructor(dataSource: DataSource) {
        super(OrganizationProfile, dataSource);
    }

    findByOrganizationId(organizationId: string): Promise<OrganizationProfile | null> {
        return this.findOneBy({ organizationId });
    }
}
```

- [ ] **Step 3: Write the failing service test**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.spec.ts
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationPlanTier } from '@parishbooks/database';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileService', () => {
    let service: OrganizationProfileService;
    let repository: { findByOrganizationId: jest.Mock; create: jest.Mock; save: jest.Mock };

    beforeEach(async () => {
        repository = {
            findByOrganizationId: jest.fn(),
            create: jest.fn((input) => input),
            save: jest.fn((input) => input),
        };

        const module = await Test.createTestingModule({
            providers: [OrganizationProfileService, { provide: OrganizationProfileRepository, useValue: repository }],
        }).compile();

        service = module.get(OrganizationProfileService);
    });

    it('throws ConflictException when a profile already exists', async () => {
        repository.findByOrganizationId.mockResolvedValue({ id: 'existing-profile' });

        await expect(service.create('org-1', { timezone: 'Asia/Kolkata' })).rejects.toThrow(ConflictException);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('creates with planTier=starter regardless of caller input', async () => {
        repository.findByOrganizationId.mockResolvedValue(null);

        await service.create('org-1', { timezone: 'Asia/Kolkata' });

        expect(repository.create).toHaveBeenCalledWith(
            expect.objectContaining({ organizationId: 'org-1', timezone: 'Asia/Kolkata', planTier: OrganizationPlanTier.STARTER }),
        );
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testFile=organization-profile.service.spec.ts`
Expected: FAIL — `Cannot find module './organization-profile.service'`.

- [ ] **Step 5: Write the service**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { OrganizationPlanTier, OrganizationProfile } from '@parishbooks/database';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { OrganizationProfileRepository } from './organization-profile.repository';

@Injectable()
export class OrganizationProfileService {
    constructor(private readonly repository: OrganizationProfileRepository) {}

    async create(organizationId: string, dto: CreateOrganizationProfileDto): Promise<OrganizationProfile> {
        const existing = await this.repository.findByOrganizationId(organizationId);
        if (existing) {
            throw new ConflictException(`Organization profile already exists for organization ${organizationId}`);
        }

        const profile = this.repository.create({
            organizationId,
            timezone: dto.timezone,
            country: dto.country,
            currency: dto.currency,
            fcraRegistered: dto.fcraRegistered,
            registrationNumber: dto.registrationNumber,
            taxExemptionNumber80g: dto.taxExemptionNumber80g,
            planTier: OrganizationPlanTier.STARTER,
        });

        return this.repository.save(profile);
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testFile=organization-profile.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-profile/
git commit -m "feat(org-svc): add OrganizationProfileRepository and Service"
```

---

### Task 4: `OrganizationProfileController` + module wiring

**Files:**
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/dto/organization-profile.dto.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.spec.ts`
- Create: `apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.module.ts`
- Modify: `apps/parishbooks-org-svc/src/app/app.module.ts`

**Interfaces:**
- Consumes: `OrganizationProfileService.create(organizationId, dto)` (Task 3), `ApiProperty` decorator (`@parishbooks/core`, same one used in `apps/parishbooks-auth-svc/src/app/app.controller.ts`).
- Produces: `POST /api/organizations/:organizationId/profile` — the exact URL Task 5's auth-svc call targets.

- [ ] **Step 1: Write the response DTO**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/dto/organization-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationCountry, OrganizationCurrency, OrganizationPlanTier } from '@parishbooks/database';

export class OrganizationProfileDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    organizationId!: string;

    @ApiProperty({ enum: OrganizationCountry })
    country!: OrganizationCountry;

    @ApiProperty()
    fcraRegistered!: boolean;

    @ApiProperty({ enum: OrganizationPlanTier })
    planTier!: OrganizationPlanTier;

    @ApiProperty()
    timezone!: string;

    @ApiProperty({ enum: OrganizationCurrency })
    currency!: OrganizationCurrency;

    @ApiPropertyOptional({ type: String, nullable: true })
    registrationNumber?: string | null;

    @ApiPropertyOptional({ type: String, nullable: true })
    taxExemptionNumber80g?: string | null;

    @ApiProperty()
    createdAt!: Date;
}
```

- [ ] **Step 2: Write the failing controller test**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileService } from './organization-profile.service';

describe('OrganizationProfileController', () => {
    let controller: OrganizationProfileController;
    let service: { create: jest.Mock };

    beforeEach(async () => {
        service = { create: jest.fn() };
        const module = await Test.createTestingModule({
            controllers: [OrganizationProfileController],
            providers: [{ provide: OrganizationProfileService, useValue: service }],
        }).compile();

        controller = module.get(OrganizationProfileController);
    });

    it('rejects when the organizationId path param does not match x-tenant-id', () => {
        expect(() => controller.create('org-1', 'org-2', { timezone: 'Asia/Kolkata' })).toThrow(BadRequestException);
        expect(service.create).not.toHaveBeenCalled();
    });

    it('delegates to the service when ids match', async () => {
        service.create.mockResolvedValue({ id: 'profile-1' });

        const result = await controller.create('org-1', 'org-1', { timezone: 'Asia/Kolkata' });

        expect(service.create).toHaveBeenCalledWith('org-1', { timezone: 'Asia/Kolkata' });
        expect(result).toEqual({ id: 'profile-1' });
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx nx test parishbooks-org-svc --testFile=organization-profile.controller.spec.ts`
Expected: FAIL — `Cannot find module './organization-profile.controller'`.

- [ ] **Step 4: Write the controller**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.controller.ts
import { BadRequestException, Body, Controller, Headers, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@parishbooks/core';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { OrganizationProfileDto } from './dto/organization-profile.dto';
import { OrganizationProfileService } from './organization-profile.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationProfileController {
    constructor(private readonly service: OrganizationProfileService) {}

    @ApiProperty({ name: 'createOrganizationProfile', status: HttpStatus.CREATED, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Post(':organizationId/profile')
    create(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string, @Body() dto: CreateOrganizationProfileDto) {
        if (organizationId !== tenantId) {
            throw new BadRequestException('organizationId path parameter must match x-tenant-id header');
        }
        return this.service.create(organizationId, dto);
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx nx test parishbooks-org-svc --testFile=organization-profile.controller.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the feature module**

```ts
// apps/parishbooks-org-svc/src/app/organization-profile/organization-profile.module.ts
import { Module } from '@nestjs/common';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

@Module({
    controllers: [OrganizationProfileController],
    providers: [OrganizationProfileService, OrganizationProfileRepository],
})
export class OrganizationProfileModule {}
```

- [ ] **Step 7: Import it into `AppModule`**

```ts
// apps/parishbooks-org-svc/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthContext, AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { DatabaseModule } from '@parishbooks/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationProfileModule } from './organization-profile/organization-profile.module';

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
        OrganizationProfileModule,
    ],
    controllers: [AppController],
    providers: [AppService, AuthContext, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
```

- [ ] **Step 8: Build**

Run: `npx nx build parishbooks-org-svc`
Expected: webpack compiles successfully.

- [ ] **Step 9: Commit**

```bash
git add apps/parishbooks-org-svc/src/app/organization-profile/ apps/parishbooks-org-svc/src/app/app.module.ts
git commit -m "feat(org-svc): add OrganizationProfileController and mount its module"
```

---

### Task 5: auth-svc integration

**Files:**
- Modify: `apps/parishbooks-auth-svc/src/app/dto/organization.dto.ts`
- Modify: `apps/parishbooks-auth-svc/src/app/app.service.ts`
- Create: `apps/parishbooks-auth-svc/src/app/app.service.spec.ts`
- Modify: `.env`

**Interfaces:**
- Consumes: `HttpClientService.post<T>(url, data?, config?)` (`@parishbooks/core`, existing, unchanged), `ConfigService.getOrThrow<string>('ORG_SERVICE_URL')`.
- Produces: `AppService.createOrganization(dto: CreateOrganizationDto, headers: Headers)` now has the same return type as before (whatever `authService.api.createOrganization` resolves to) but additionally calls org-svc as a side effect before resolving.

- [ ] **Step 1: Add `timezone` to `CreateOrganizationDto`**

```ts
// apps/parishbooks-auth-svc/src/app/dto/organization.dto.ts — add to CreateOrganizationDto, after `slug`
    @ApiProperty({ example: 'Asia/Kolkata' })
    @IsString()
    timezone!: string;
```

- [ ] **Step 2: Add `ORG_SERVICE_URL` to `.env`**

```bash
# .env — add alongside AUTH_SERVICE_URL
ORG_SERVICE_URL="http://localhost:3006"
```

- [ ] **Step 3: Write the failing service test**

```ts
// apps/parishbooks-auth-svc/src/app/app.service.spec.ts
jest.mock('../auth', () => ({ auth: {} }));

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { HttpClientService } from '@parishbooks/core';
import { AppService } from './app.service';

describe('AppService#createOrganization', () => {
    let service: AppService;
    let authService: { api: { createOrganization: jest.Mock } };
    let httpClient: { post: jest.Mock };
    let configService: { getOrThrow: jest.Mock };

    const dto = { name: 'St. Mary Parish', slug: 'st-mary-parish', timezone: 'Asia/Kolkata' };
    const headers = new Headers({ authorization: 'Bearer token-123' });

    beforeEach(async () => {
        authService = { api: { createOrganization: jest.fn() } };
        httpClient = { post: jest.fn() };
        configService = { getOrThrow: jest.fn().mockReturnValue('http://localhost:3006') };

        const module = await Test.createTestingModule({
            providers: [
                AppService,
                { provide: AuthService, useValue: authService },
                { provide: HttpClientService, useValue: httpClient },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get(AppService);
    });

    it('creates the org-svc profile after BetterAuth creates the organization', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1', name: dto.name, slug: dto.slug });

        const result = await service.createOrganization(dto, headers);

        expect(httpClient.post).toHaveBeenCalledWith(
            'http://localhost:3006/api/organizations/org-1/profile',
            { timezone: 'Asia/Kolkata' },
            { headers: { Authorization: 'Bearer token-123', 'x-tenant-id': 'org-1' } },
        );
        expect(result).toEqual({ id: 'org-1', name: dto.name, slug: dto.slug });
    });

    it('propagates the failure when org-svc rejects the profile call', async () => {
        authService.api.createOrganization.mockResolvedValue({ id: 'org-1' });
        httpClient.post.mockRejectedValue(new Error('org-svc unreachable'));

        await expect(service.createOrganization(dto, headers)).rejects.toThrow('org-svc unreachable');
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx nx test parishbooks-auth-svc --testFile=app.service.spec.ts`
Expected: FAIL — `httpClient.post` was never called (current `createOrganization` doesn't call org-svc yet).

- [ ] **Step 5: Update `AppService`**

```ts
// apps/parishbooks-auth-svc/src/app/app.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '@parishbooks/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { auth } from '../auth';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    SendEmailOtpDto,
    SignInDto,
    SignUpDto,
    UpdateProfileDto,
    VerifyEmailOtpDto,
} from './dto/email-auth.dto';
import { GoogleSignInDto } from './dto/google-auth.dto';
import {
    AcceptInvitationDto,
    CreateOrganizationDto,
    InviteMemberDto,
    SetActiveOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class AppService {
    constructor(
        private readonly authService: AuthService<typeof auth>,
        private readonly httpClient: HttpClientService,
        private readonly configService: ConfigService,
    ) {}

    signUp(dto: SignUpDto) {
        return this.authService.api.signUpEmail({ body: { ...dto } });
    }

    signIn(dto: SignInDto) {
        return this.authService.api.signInEmail({ body: { ...dto } });
    }

    signOut(headers: Headers) {
        return this.authService.api.signOut({ headers });
    }

    sendEmailOtp(dto: SendEmailOtpDto) {
        return this.authService.api.sendVerificationOTP({ body: { ...dto, type: 'email-verification' } });
    }

    verifyEmailOtp(dto: VerifyEmailOtpDto) {
        return this.authService.api.verifyEmailOTP({ body: { ...dto } });
    }

    forgotPassword(dto: ForgotPasswordDto) {
        return this.authService.api.requestPasswordReset({ body: { ...dto } });
    }

    resetPassword(dto: ResetPasswordDto) {
        return this.authService.api.resetPassword({ body: { ...dto } });
    }

    changePassword(dto: ChangePasswordDto, headers: Headers) {
        return this.authService.api.changePassword({ body: { ...dto }, headers });
    }

    updateProfile(dto: UpdateProfileDto, headers: Headers) {
        return this.authService.api.updateUser({ body: { ...dto }, headers });
    }

    googleSignIn(dto: GoogleSignInDto) {
        return this.authService.api.signInSocial({ body: { provider: 'google', callbackURL: dto.callbackURL } });
    }

    async createOrganization(dto: CreateOrganizationDto, headers: Headers) {
        const { timezone, ...organizationDto } = dto;
        const org = await this.authService.api.createOrganization({ body: { ...organizationDto }, headers });

        const orgServiceUrl = this.configService.getOrThrow<string>('ORG_SERVICE_URL');
        await this.httpClient.post(
            `${orgServiceUrl}/api/organizations/${org.id}/profile`,
            { timezone },
            {
                headers: {
                    Authorization: headers.get('authorization'),
                    'x-tenant-id': org.id,
                },
            },
        );

        return org;
    }

    listOrganizations(headers: Headers) {
        return this.authService.api.listOrganizations({ headers });
    }

    setActiveOrganization(dto: SetActiveOrganizationDto, headers: Headers) {
        return this.authService.api.setActiveOrganization({ body: { ...dto }, headers });
    }

    inviteMember(organizationId: string, dto: InviteMemberDto, headers: Headers) {
        return this.authService.api.createInvitation({ body: { ...dto, organizationId }, headers });
    }

    acceptInvitation(dto: AcceptInvitationDto, headers: Headers) {
        return this.authService.api.acceptInvitation({ body: { ...dto }, headers });
    }

    listMembers(organizationId: string, headers: Headers) {
        return this.authService.api.listMembers({ query: { organizationId }, headers });
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx nx test parishbooks-auth-svc --testFile=app.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Build**

Run: `npx nx build parishbooks-auth-svc`
Expected: webpack compiles successfully.

- [ ] **Step 8: Commit**

```bash
git add apps/parishbooks-auth-svc/src/app/dto/organization.dto.ts \
        apps/parishbooks-auth-svc/src/app/app.service.ts \
        apps/parishbooks-auth-svc/src/app/app.service.spec.ts \
        .env
git commit -m "feat(auth-svc): call org-svc to create OrganizationProfile on org creation"
```

---

### Task 6: End-to-end verification

**Files:** none (manual verification only).

- [ ] **Step 1: Start both services**

```bash
npx nx serve parishbooks-org-svc &
npx nx serve parishbooks-auth-svc &
```

Expected: both log `Application is running on: http://localhost:3006/api` and `http://localhost:3000/api` with no DI or startup errors.

- [ ] **Step 2: Sign up a user to get a bearer token**

```bash
curl -s -X POST http://localhost:3000/api/identity/sign-up \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e-test@example.com","password":"password123","name":"E2E Test"}'
```

Expected: `201`, JSON body with a `token` field. Save it as `$TOKEN` for the next step.

- [ ] **Step 3: Create an organization**

```bash
curl -s -X POST http://localhost:3000/api/identity/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"St. Mary Parish","slug":"st-mary-parish-e2e","timezone":"Asia/Kolkata"}'
```

Expected: `201`, JSON body with the created organization's `id`. Save it as `$ORG_ID`.

- [ ] **Step 4: Verify the profile row exists**

```bash
psql "$DATABASE_URL" -c "SELECT \"organizationId\", country, \"planTier\", timezone, currency FROM organization_profile WHERE \"organizationId\" = '$ORG_ID';"
```

Expected: one row, `country=IN`, `planTier=starter`, `timezone=Asia/Kolkata`, `currency=INR`.

- [ ] **Step 5: Verify the failure path**

Stop org-svc (`kill %1` or Ctrl+C its process), then repeat Step 3 with a different `slug`.

Expected: the `POST /identity/organizations` call returns an error (not `201`) — confirming the synchronous-failure behavior from the spec. Restart org-svc afterward.

- [ ] **Step 6: Stop both services**

```bash
kill %1 %2 2>/dev/null
```

No commit for this task — it's verification only.
