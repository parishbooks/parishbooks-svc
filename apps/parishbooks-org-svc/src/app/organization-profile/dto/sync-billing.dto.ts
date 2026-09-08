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
