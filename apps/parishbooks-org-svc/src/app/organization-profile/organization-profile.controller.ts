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
