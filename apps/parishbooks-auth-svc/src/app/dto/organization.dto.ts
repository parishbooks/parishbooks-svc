import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export type OrganizationRole = 'member' | 'admin' | 'owner';

export class CreateOrganizationDto {
    @ApiProperty({ example: 'St. Mary Parish' })
    @IsString()
    name!: string;

    @ApiProperty({ example: 'st-mary-parish' })
    @IsString()
    slug!: string;

    @ApiProperty({ example: 'Asia/Kolkata' })
    @IsString()
    timezone!: string;

    @ApiPropertyOptional({ description: 'Organization logo URL' })
    @IsOptional()
    @IsString()
    logo?: string;

    @ApiPropertyOptional({ default: false, description: 'Keep the currently active organization instead of switching to the new one' })
    @IsOptional()
    @IsBoolean()
    keepCurrentActiveOrganization?: boolean;
}

export class SetActiveOrganizationDto {
    @ApiPropertyOptional({ description: 'Organization ID to activate' })
    @IsOptional()
    @IsString()
    organizationId?: string;

    @ApiPropertyOptional({ description: 'Organization slug to activate' })
    @IsOptional()
    @IsString()
    organizationSlug?: string;
}

export class InviteMemberDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ enum: ['member', 'admin', 'owner'] })
    @IsIn(['member', 'admin', 'owner'])
    role!: OrganizationRole;

    @ApiPropertyOptional({ default: false, description: 'Resend the invitation email if one already exists' })
    @IsOptional()
    @IsBoolean()
    resend?: boolean;
}

export class AcceptInvitationDto {
    @ApiProperty({ description: 'Invitation ID to accept' })
    @IsString()
    invitationId!: string;
}
