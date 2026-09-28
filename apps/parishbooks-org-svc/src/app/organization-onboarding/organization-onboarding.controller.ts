import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, AuthContext, TENANT_ID_HEADER } from '@parishbooks/core';
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

    @ApiProperty({ name: 'submitOrganizationOnboarding', status: HttpStatus.CREATED, responseType: OnboardingStatusDto, tenantHeader: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Post(':organizationId/onboarding')
    submit(@Param('organizationId') organizationId: string, @Headers(TENANT_ID_HEADER) tenantId: string, @Body() dto: SubmitOnboardingDto) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.submit(organizationId, this.currentUserId(), dto));
    }

    @ApiProperty({ name: 'getOrganizationOnboardingStatus', status: HttpStatus.OK, responseType: OnboardingStatusDto, tenantHeader: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get(':organizationId/onboarding/status')
    status(@Param('organizationId') organizationId: string, @Headers(TENANT_ID_HEADER) tenantId: string) {
        return this.assertTenantMatch(organizationId, tenantId, () => this.service.getStatus(organizationId));
    }

    private currentUserId(): string {
        const userId = this.authContext.getUser()?.id;
        if (!userId) throw new BadRequestException('No authenticated user in request context');
        return userId;
    }

    // x-tenant-id is client-supplied and, on its own, only catches BFF
    // routing bugs — it proves nothing about who the caller actually is.
    // The authoritative check is against the session's own organization,
    // resolved server-side by AuthGuard from the verified JWT, which a
    // caller cannot forge by setting a header.
    private assertTenantMatch<T>(organizationId: string, tenantId: string, fn: () => T): T {
        if (organizationId !== tenantId) throw new BadRequestException('organizationId path parameter must match x-tenant-id header');
        const sessionOrganizationId = this.authContext.getSession()?.session.activeOrganizationId;
        if (organizationId !== sessionOrganizationId) throw new ForbiddenException('organizationId does not match the authenticated session\'s organization');
        return fn();
    }
}
