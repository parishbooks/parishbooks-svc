import { BadRequestException, Body, Controller, Get, Headers, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, InternalServiceGuard, Public } from '@parishbooks/core';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { OrganizationProfileDto } from './dto/organization-profile.dto';
import { SyncBillingDto } from './dto/sync-billing.dto';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { OrganizationProfileService } from './organization-profile.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationProfileController {
    constructor(private readonly service: OrganizationProfileService) {}

    @ApiProperty({ name: 'createOrganizationProfile', status: HttpStatus.CREATED, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Post(':organizationId/profile')
    create(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string, @Body() dto: CreateOrganizationProfileDto) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.create(organizationId, dto));
    }

    @ApiProperty({ name: 'getOrganizationProfile', status: HttpStatus.OK, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get(':organizationId/profile')
    findOne(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.findByOrganizationId(organizationId));
    }

    @ApiProperty({ name: 'updateOrganizationProfile', status: HttpStatus.OK, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Patch(':organizationId/profile')
    update(@Param('organizationId') organizationId: string, @Headers('x-tenant-id') tenantId: string, @Body() dto: UpdateOrganizationProfileDto) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.update(organizationId, dto));
    }

    @ApiProperty({ name: 'syncOrganizationBilling', status: HttpStatus.OK, responseType: OrganizationProfileDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Patch(':organizationId/billing-sync')
    syncBilling(@Param('organizationId') organizationId: string, @Body() dto: SyncBillingDto) {
        return this.service.syncBilling(organizationId, dto);
    }

    private assertTenantMatch<T>(organizationId: string, tenantId: string, fn: () => T): T {
        const errMessage = 'organizationId path parameter must match x-tenant-id header';
        if (organizationId !== tenantId) throw new BadRequestException(errMessage);
        return fn();
    }
}
