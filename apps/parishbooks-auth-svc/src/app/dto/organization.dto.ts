import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export type OrganizationRole = 'member' | 'admin' | 'owner';

export class CreateOrganizationDto {
    @IsString()
    name!: string;

    @IsString()
    slug!: string;

    @IsOptional()
    @IsString()
    logo?: string;

    @IsOptional()
    @IsBoolean()
    keepCurrentActiveOrganization?: boolean;
}

export class SetActiveOrganizationDto {
    @IsOptional()
    @IsString()
    organizationId?: string;

    @IsOptional()
    @IsString()
    organizationSlug?: string;
}

export class InviteMemberDto {
    @IsEmail()
    email!: string;

    @IsIn(['member', 'admin', 'owner'])
    role!: OrganizationRole;

    @IsOptional()
    @IsBoolean()
    resend?: boolean;
}

export class AcceptInvitationDto {
    @IsString()
    invitationId!: string;
}
