import { Injectable } from '@nestjs/common';
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
    constructor(private readonly authService: AuthService<typeof auth>) {}

    async signUp(dto: SignUpDto) {
        const result = await this.authService.api.signUpEmail({ body: { ...dto } });
        if (!result.token) return result;
        const sessionToken = result.token;
        const token = await this.mintToken(this.bearerHeaders(sessionToken));
        return { ...result, sessionToken, token };
    }

    async signIn(dto: SignInDto) {
        const result = await this.authService.api.signInEmail({ body: { ...dto } });
        const sessionToken = result.token;
        const token = await this.mintToken(this.bearerHeaders(sessionToken));
        return { ...result, sessionToken, token };
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

    createOrganization(dto: CreateOrganizationDto, headers: Headers) {
        const { timezone, ...organizationDto } = dto;
        return this.authService.api.createOrganization({ body: { ...organizationDto, metadata: { timezone } }, headers });
    }

    listOrganizations(headers: Headers) {
        return this.authService.api.listOrganizations({ headers });
    }

    async setActiveOrganization(dto: SetActiveOrganizationDto, headers: Headers) {
        const org = await this.authService.api.setActiveOrganization({ body: { ...dto }, headers });
        const sessionToken = this.sessionTokenFromHeaders(headers);
        const token = await this.mintToken(headers);
        return sessionToken ? { ...org, sessionToken, token } : { ...org, token };
    }

    getToken(headers: Headers): Promise<{ token: string }> {
        return this.authService.api.getToken({ headers });
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

    private bearerHeaders(token: string): Headers {
        return new Headers({ authorization: `Bearer ${token}` });
    }

    /** Opaque Better Auth session bearer (not the minted JWT). */
    private sessionTokenFromHeaders(headers: Headers): string | undefined {
        const bearer = headers.get('authorization')?.replace(/^Bearer /i, '').trim();
        if (!bearer || bearer.split('.').length >= 3) return undefined;
        return bearer;
    }

    private async mintToken(headers: Headers): Promise<string> {
        const { token } = await this.authService.api.getToken({ headers });
        return token;
    }
}
