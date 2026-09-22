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
