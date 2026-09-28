import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole } from './organization.dto';

export class UserResponseDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    email!: string;

    @ApiProperty()
    emailVerified!: boolean;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional({ type: String, nullable: true })
    image?: string | null;
}

export class SignUpResponseDto {
    @ApiPropertyOptional({ type: String, nullable: true, description: 'JWT for downstream microservices. Null when email verification is required before a session is created.' })
    token!: string | null;

    @ApiProperty({ type: UserResponseDto })
    user!: UserResponseDto;
}

export class SignInResponseDto {
    @ApiProperty()
    redirect!: boolean;

    @ApiProperty({ description: 'JWT for downstream microservices' })
    token!: string;

    @ApiPropertyOptional()
    url?: string;

    @ApiProperty({ type: UserResponseDto })
    user!: UserResponseDto;
}

export class GoogleSignInResponseDto {
    @ApiProperty()
    redirect!: boolean;

    @ApiPropertyOptional()
    url?: string;

    @ApiPropertyOptional()
    token?: string;

    @ApiPropertyOptional({ type: UserResponseDto })
    user?: UserResponseDto;
}

export class SignOutResponseDto {
    @ApiProperty()
    success!: boolean;

    @ApiPropertyOptional()
    url?: string;

    @ApiPropertyOptional()
    redirect?: boolean;
}

export class SessionDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;

    @ApiProperty()
    userId!: string;

    @ApiProperty()
    expiresAt!: Date;

    @ApiProperty()
    token!: string;

    @ApiPropertyOptional({ type: String, nullable: true })
    ipAddress?: string | null;

    @ApiPropertyOptional({ type: String, nullable: true })
    userAgent?: string | null;

    @ApiPropertyOptional({ type: String, nullable: true, description: 'Active organization id from Better Auth organization plugin' })
    activeOrganizationId?: string | null;
}

export class GetSessionResponseDto {
    @ApiProperty({ type: SessionDto })
    session!: SessionDto;

    @ApiProperty({ type: UserResponseDto })
    user!: UserResponseDto;
}

export class StatusResponseDto {
    @ApiProperty()
    status!: boolean;
}

export class RequestPasswordResetResponseDto {
    @ApiProperty()
    status!: boolean;

    @ApiProperty()
    message!: string;
}

export class ChangePasswordResponseDto {
    @ApiPropertyOptional({ type: String, nullable: true })
    token!: string | null;

    @ApiProperty({ type: UserResponseDto })
    user!: UserResponseDto;
}

export class OrganizationDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    slug!: string;

    @ApiPropertyOptional({ type: String, nullable: true })
    logo?: string | null;

    @ApiPropertyOptional()
    metadata?: Record<string, unknown>;

    @ApiProperty()
    createdAt!: Date;
}

export class MemberDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    organizationId!: string;

    @ApiProperty()
    userId!: string;

    @ApiProperty({ enum: ['member', 'admin', 'owner'] })
    role!: OrganizationRole;

    @ApiProperty()
    createdAt!: Date;
}

export class InvitationDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    organizationId!: string;

    @ApiProperty()
    email!: string;

    @ApiProperty({ enum: ['member', 'admin', 'owner'] })
    role!: OrganizationRole;

    @ApiProperty({ enum: ['pending', 'accepted', 'rejected', 'canceled'] })
    status!: 'pending' | 'accepted' | 'rejected' | 'canceled';

    @ApiProperty()
    inviterId!: string;

    @ApiProperty()
    expiresAt!: Date;

    @ApiProperty()
    createdAt!: Date;
}

export class OrganizationWithRelationsDto extends OrganizationDto {
    @ApiProperty({ type: [MemberDto] })
    members!: MemberDto[];

    @ApiProperty({ type: [InvitationDto] })
    invitations!: InvitationDto[];
}

export class OrganizationWithTokenDto extends OrganizationWithRelationsDto {
    @ApiProperty({ description: 'Freshly minted JWT reflecting this organization as the active one' })
    token!: string;
}

export class GetTokenResponseDto {
    @ApiProperty()
    token!: string;
}

export class SessionStatusResponseDto {
    @ApiProperty()
    active!: boolean;

    @ApiProperty()
    isMember!: boolean;

    @ApiPropertyOptional({ type: String, nullable: true })
    activeOrganizationId!: string | null;
}

export class AcceptInvitationResponseDto {
    @ApiProperty({ type: InvitationDto })
    invitation!: InvitationDto;

    @ApiProperty({ type: MemberDto })
    member!: MemberDto;
}

export class MemberUserDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    email!: string;

    @ApiProperty()
    name!: string;

    @ApiPropertyOptional()
    image?: string;
}

export class MemberWithUserDto extends MemberDto {
    @ApiProperty({ type: MemberUserDto })
    user!: MemberUserDto;
}

export class ListMembersResponseDto {
    @ApiProperty({ type: [MemberWithUserDto] })
    members!: MemberWithUserDto[];

    @ApiProperty()
    total!: number;
}
