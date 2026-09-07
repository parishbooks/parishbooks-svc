import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '@parishbooks/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { auth } from '../auth';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    SendEmailOtpDto,
    SignInDto,
    SignUpDto,
    UpdateProfileDto,
    VerifyEmailOtpDto,
} from './dto/email-auth.dto';
import { GoogleSignInDto } from './dto/google-auth.dto';
import {
    AcceptInvitationDto,
    CreateOrganizationDto,
    InviteMemberDto,
    SetActiveOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class AppService {
    constructor(
        private readonly authService: AuthService<typeof auth>,
        private readonly httpClient: HttpClientService,
        private readonly configService: ConfigService,
    ) {}

    signUp(dto: SignUpDto) {
        return this.authService.api.signUpEmail({ body: { ...dto } });
    }

    signIn(dto: SignInDto) {
        return this.authService.api.signInEmail({ body: { ...dto } });
    }

    signOut(headers: Headers) {
        return this.authService.api.signOut({ headers });
    }

    sendEmailOtp(dto: SendEmailOtpDto) {
        return this.authService.api.sendVerificationOTP({ body: { ...dto, type: 'email-verification' } });
    }

    verifyEmailOtp(dto: VerifyEmailOtpDto) {
        return this.authService.api.verifyEmailOTP({ body: { ...dto } });
    }

    forgotPassword(dto: ForgotPasswordDto) {
        return this.authService.api.requestPasswordReset({ body: { ...dto } });
    }

    resetPassword(dto: ResetPasswordDto) {
        return this.authService.api.resetPassword({ body: { ...dto } });
    }

    changePassword(dto: ChangePasswordDto, headers: Headers) {
        return this.authService.api.changePassword({ body: { ...dto }, headers });
    }

    updateProfile(dto: UpdateProfileDto, headers: Headers) {
        return this.authService.api.updateUser({ body: { ...dto }, headers });
    }

    googleSignIn(dto: GoogleSignInDto) {
        return this.authService.api.signInSocial({ body: { provider: 'google', callbackURL: dto.callbackURL } });
    }

    async createOrganization(dto: CreateOrganizationDto, headers: Headers) {
        const { timezone, ...organizationDto } = dto;
        const org = await this.authService.api.createOrganization({ body: { ...organizationDto }, headers });

        const orgServiceUrl = this.configService.getOrThrow<string>('ORG_SERVICE_URL');
        await this.httpClient.post(
            `${orgServiceUrl}/api/organizations/${org.id}/profile`,
            { timezone },
            {
                headers: {
                    Authorization: headers.get('authorization'),
                    'x-tenant-id': org.id,
                },
            },
        );

        return org;
    }

    listOrganizations(headers: Headers) {
        return this.authService.api.listOrganizations({ headers });
    }

    setActiveOrganization(dto: SetActiveOrganizationDto, headers: Headers) {
        return this.authService.api.setActiveOrganization({ body: { ...dto }, headers });
    }

    inviteMember(organizationId: string, dto: InviteMemberDto, headers: Headers) {
        return this.authService.api.createInvitation({ body: { ...dto, organizationId }, headers });
    }

    acceptInvitation(dto: AcceptInvitationDto, headers: Headers) {
        return this.authService.api.acceptInvitation({ body: { ...dto }, headers });
    }

    listMembers(organizationId: string, headers: Headers) {
        return this.authService.api.listMembers({ query: { organizationId }, headers });
    }
}
