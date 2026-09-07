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
