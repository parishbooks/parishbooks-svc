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
