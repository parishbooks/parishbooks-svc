import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, AuthContext, InternalServiceGuard, Public, TENANT_ID_HEADER } from '@parishbooks/core';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { OrganizationProfileDto } from './dto/organization-profile.dto';
import { SyncBillingDto } from './dto/sync-billing.dto';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { OrganizationProfileService } from './organization-profile.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationProfileController {
    constructor(
        private readonly service: OrganizationProfileService,
        private readonly authContext: AuthContext,
    ) {}

    // Internal service-to-service call (auth-svc, on org creation), guarded
    // by InternalServiceGuard's shared secret rather than a user session —
    // there is no AuthContext session to check here, so this keeps the
    // header-only check.
    @ApiProperty({ name: 'createOrganizationProfile', status: HttpStatus.CREATED, responseType: OrganizationProfileDto, internal: true, tenantHeader: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Post(':organizationId/profile')
    create(@Param('organizationId') organizationId: string, @Headers(TENANT_ID_HEADER) tenantId: string, @Body() dto: CreateOrganizationProfileDto) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.create(organizationId, dto));
    }

    @ApiProperty({ name: 'getOrganizationProfile', status: HttpStatus.OK, responseType: OrganizationProfileDto, tenantHeader: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get(':organizationId/profile')
    findOne(@Param('organizationId') organizationId: string, @Headers(TENANT_ID_HEADER) tenantId: string) {
        return this.assertUserTenantMatch(organizationId, tenantId, () => this.service.findByOrganizationId(organizationId));
    }

    @ApiProperty({ name: 'updateOrganizationProfile', status: HttpStatus.OK, responseType: OrganizationProfileDto, tenantHeader: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Patch(':organizationId/profile')
    update(@Param('organizationId') organizationId: string, @Headers(TENANT_ID_HEADER) tenantId: string, @Body() dto: UpdateOrganizationProfileDto) {
        return this.assertUserTenantMatch(organizationId, tenantId, () => this.service.update(organizationId, dto));
    }

    // Internal service-to-service call (billing-svc/Stripe/Cashfree sync),
    // guarded by InternalServiceGuard — same reasoning as create() above.
    @ApiProperty({ name: 'syncOrganizationBilling', status: HttpStatus.OK, responseType: OrganizationProfileDto, internal: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Patch(':organizationId/billing-sync')
    syncBilling(@Param('organizationId') organizationId: string, @Body() dto: SyncBillingDto) {
        return this.service.syncBilling(organizationId, dto);
    }

    private assertTenantMatch<T>(organizationId: string, tenantId: string, fn: () => T): T {
        if (organizationId !== tenantId) throw new BadRequestException('organizationId path parameter must match x-tenant-id header');
        return fn();
    }

    // x-tenant-id is client-supplied and, on its own, only catches BFF
    // routing bugs — it proves nothing about who the caller actually is.
    // The authoritative check is against the session's own organization,
    // resolved server-side by AuthGuard from the verified JWT, which a
    // caller cannot forge by setting a header. Only applies to user-facing
    // routes — create()/syncBilling() are internal-service calls with no
    // session to check.
    private assertUserTenantMatch<T>(organizationId: string, tenantId: string, fn: () => T): T {
        return this.assertTenantMatch(organizationId, tenantId, () => {
            const sessionOrganizationId = this.authContext.getSession()?.session.activeOrganizationId;
            if (organizationId !== sessionOrganizationId) throw new ForbiddenException('organizationId does not match the authenticated session\'s organization');
            return fn();
        });
    }
}
