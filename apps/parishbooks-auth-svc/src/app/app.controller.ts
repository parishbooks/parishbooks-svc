import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, opaqueSessionHeaders, Public, SessionToken } from '@parishbooks/core';
import { AppService } from './app.service';
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
import { CreateOrganizationDto, InviteMemberDto, SetActiveOrganizationDto } from './dto/organization.dto';
import {
    AcceptInvitationResponseDto,
    ChangePasswordResponseDto,
    GetSessionResponseDto,
    GetTokenResponseDto,
    GoogleSignInResponseDto,
    InvitationDto,
    ListMembersResponseDto,
    OrganizationDto,
    OrganizationWithRelationsDto,
    OrganizationWithTokenDto,
    RequestPasswordResetResponseDto,
    SignInResponseDto,
    SignOutResponseDto,
    SignUpResponseDto,
    StatusResponseDto,
} from './dto/response.dto';

@ApiTags('identity')
@Controller('identity')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @ApiProperty({ name: 'signUp', status: HttpStatus.CREATED, responseType: SignUpResponseDto, public: true })
    @Public()
    @Post('sign-up')
    signUp(@Body() dto: SignUpDto) {
        return this.appService.signUp(dto);
    }

    @ApiProperty({ name: 'signIn', status: HttpStatus.OK, responseType: SignInResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('sign-in')
    signIn(@Body() dto: SignInDto) {
        return this.appService.signIn(dto);
    }

    @ApiProperty({ name: 'googleSignIn', status: HttpStatus.OK, responseType: GoogleSignInResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('google/sign-in')
    googleSignIn(@Body() dto: GoogleSignInDto) {
        return this.appService.googleSignIn(dto);
    }

    @ApiProperty({ name: 'signOut', status: HttpStatus.OK, responseType: SignOutResponseDto })
    @HttpCode(HttpStatus.OK)
    @Post('sign-out')
    signOut(@SessionToken() sessionToken: string) {
        return this.appService.signOut(opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'getSession', status: HttpStatus.OK, responseType: GetSessionResponseDto })
    @Get('session')
    getSession(@SessionToken() sessionToken: string) {
        return this.appService.getSession(opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'getToken', status: HttpStatus.OK, responseType: GetTokenResponseDto })
    @Get('token')
    getToken(@SessionToken() sessionToken: string) {
        return this.appService.getToken(opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'sendEmailOtp', status: HttpStatus.OK, responseType: StatusResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('email-otp/send')
    sendEmailOtp(@Body() dto: SendEmailOtpDto) {
        return this.appService.sendEmailOtp(dto);
    }

    @ApiProperty({ name: 'verifyEmailOtp', status: HttpStatus.OK, responseType: StatusResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('email-otp/verify')
    verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
        return this.appService.verifyEmailOtp(dto);
    }

    @ApiProperty({ name: 'forgotPassword', status: HttpStatus.OK, responseType: RequestPasswordResetResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.appService.forgotPassword(dto);
    }

    @ApiProperty({ name: 'resetPassword', status: HttpStatus.OK, responseType: StatusResponseDto, public: true })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.appService.resetPassword(dto);
    }

    @ApiProperty({ name: 'changePassword', status: HttpStatus.OK, responseType: ChangePasswordResponseDto })
    @HttpCode(HttpStatus.OK)
    @Post('change-password')
    changePassword(@Body() dto: ChangePasswordDto, @SessionToken() sessionToken: string) {
        return this.appService.changePassword(dto, opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'updateProfile', status: HttpStatus.OK, responseType: StatusResponseDto })
    @Patch('profile')
    updateProfile(@Body() dto: UpdateProfileDto, @SessionToken() sessionToken: string) {
        return this.appService.updateProfile(dto, opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'createOrganization', status: HttpStatus.CREATED, responseType: OrganizationWithRelationsDto })
    @Post('organizations')
    createOrganization(@Body() dto: CreateOrganizationDto, @SessionToken() sessionToken: string) {
        return this.appService.createOrganization(dto, opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'listOrganizations', status: HttpStatus.OK, responseType: OrganizationDto, isArray: true })
    @Get('organizations')
    listOrganizations(@SessionToken() sessionToken: string) {
        return this.appService.listOrganizations(opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'setActiveOrganization', status: HttpStatus.OK, responseType: OrganizationWithTokenDto })
    @HttpCode(HttpStatus.OK)
    @Post('organizations/active')
    setActiveOrganization(@Body() dto: SetActiveOrganizationDto, @SessionToken() sessionToken: string) {
        return this.appService.setActiveOrganization(dto, sessionToken);
    }

    @ApiProperty({ name: 'inviteMember', status: HttpStatus.CREATED, responseType: InvitationDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Post('organizations/:organizationId/invitations')
    inviteMember(@Param('organizationId') organizationId: string, @Body() dto: InviteMemberDto, @SessionToken() sessionToken: string) {
        return this.appService.inviteMember(organizationId, dto, opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'acceptInvitation', status: HttpStatus.OK, responseType: AcceptInvitationResponseDto })
    @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
    @HttpCode(HttpStatus.OK)
    @Post('organizations/invitations/:invitationId/accept')
    acceptInvitation(@Param('invitationId') invitationId: string, @SessionToken() sessionToken: string) {
        return this.appService.acceptInvitation({ invitationId }, opaqueSessionHeaders(sessionToken));
    }

    @ApiProperty({ name: 'listMembers', status: HttpStatus.OK, responseType: ListMembersResponseDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get('organizations/:organizationId/members')
    listMembers(@Param('organizationId') organizationId: string, @SessionToken() sessionToken: string) {
        return this.appService.listMembers(organizationId, opaqueSessionHeaders(sessionToken));
    }
}
