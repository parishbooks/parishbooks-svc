import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@parishbooks/core';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { IncomingMessage } from 'node:http';
import { auth } from '../auth';
import { AppService } from './app.service';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    ResendVerificationEmailDto,
    ResetPasswordDto,
    SignInDto,
    SignUpDto,
    UpdateProfileDto,
    VerifyEmailDto,
} from './dto/email-auth.dto';
import { GoogleSignInDto } from './dto/google-auth.dto';
import { CreateOrganizationDto, InviteMemberDto, SetActiveOrganizationDto } from './dto/organization.dto';
import {
    AcceptInvitationResponseDto,
    ChangePasswordResponseDto,
    GetSessionResponseDto,
    GoogleSignInResponseDto,
    InvitationDto,
    ListMembersResponseDto,
    OrganizationDto,
    OrganizationWithRelationsDto,
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

    @ApiProperty({ name: 'signUp', status: HttpStatus.CREATED, responseType: SignUpResponseDto })
    @AllowAnonymous()
    @Post('sign-up')
    signUp(@Body() dto: SignUpDto) {
        return this.appService.signUp(dto);
    }

    @ApiProperty({ name: 'signIn', status: HttpStatus.OK, responseType: SignInResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('sign-in')
    signIn(@Body() dto: SignInDto) {
        return this.appService.signIn(dto);
    }

    @ApiProperty({ name: 'googleSignIn', status: HttpStatus.OK, responseType: GoogleSignInResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('google/sign-in')
    googleSignIn(@Body() dto: GoogleSignInDto) {
        return this.appService.googleSignIn(dto);
    }

    @ApiProperty({ name: 'signOut', status: HttpStatus.OK, responseType: SignOutResponseDto })
    @HttpCode(HttpStatus.OK)
    @Post('sign-out')
    signOut(@Req() req: IncomingMessage) {
        return this.appService.signOut(fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'getSession', status: HttpStatus.OK, responseType: GetSessionResponseDto })
    @Get('session')
    getSession(@Session() session: UserSession<typeof auth>) {
        return session;
    }

    @ApiProperty({ name: 'verifyEmail', status: HttpStatus.OK, responseType: StatusResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('verify-email')
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.appService.verifyEmail(dto);
    }

    @ApiProperty({ name: 'resendVerificationEmail', status: HttpStatus.OK, responseType: StatusResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('resend-verification-email')
    resendVerificationEmail(@Body() dto: ResendVerificationEmailDto) {
        return this.appService.resendVerificationEmail(dto);
    }

    @ApiProperty({ name: 'forgotPassword', status: HttpStatus.OK, responseType: RequestPasswordResetResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.appService.forgotPassword(dto);
    }

    @ApiProperty({ name: 'resetPassword', status: HttpStatus.OK, responseType: StatusResponseDto })
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.appService.resetPassword(dto);
    }

    @ApiProperty({ name: 'changePassword', status: HttpStatus.OK, responseType: ChangePasswordResponseDto })
    @HttpCode(HttpStatus.OK)
    @Post('change-password')
    changePassword(@Body() dto: ChangePasswordDto, @Req() req: IncomingMessage) {
        return this.appService.changePassword(dto, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'updateProfile', status: HttpStatus.OK, responseType: StatusResponseDto })
    @Patch('profile')
    updateProfile(@Body() dto: UpdateProfileDto, @Req() req: IncomingMessage) {
        return this.appService.updateProfile(dto, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'createOrganization', status: HttpStatus.CREATED, responseType: OrganizationWithRelationsDto })
    @Post('organizations')
    createOrganization(@Body() dto: CreateOrganizationDto, @Req() req: IncomingMessage) {
        return this.appService.createOrganization(dto, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'listOrganizations', status: HttpStatus.OK, responseType: OrganizationDto, isArray: true })
    @Get('organizations')
    listOrganizations(@Req() req: IncomingMessage) {
        return this.appService.listOrganizations(fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'setActiveOrganization', status: HttpStatus.OK, responseType: OrganizationWithRelationsDto })
    @HttpCode(HttpStatus.OK)
    @Post('organizations/active')
    setActiveOrganization(@Body() dto: SetActiveOrganizationDto, @Req() req: IncomingMessage) {
        return this.appService.setActiveOrganization(dto, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'inviteMember', status: HttpStatus.CREATED, responseType: InvitationDto })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Post('organizations/:organizationId/invitations')
    inviteMember(@Param('organizationId') organizationId: string, @Body() dto: InviteMemberDto, @Req() req: IncomingMessage) {
        return this.appService.inviteMember(organizationId, dto, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'acceptInvitation', status: HttpStatus.OK, responseType: AcceptInvitationResponseDto })
    @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
    @HttpCode(HttpStatus.OK)
    @Post('organizations/invitations/:invitationId/accept')
    acceptInvitation(@Param('invitationId') invitationId: string, @Req() req: IncomingMessage) {
        return this.appService.acceptInvitation({ invitationId }, fromNodeHeaders(req.headers));
    }

    @ApiProperty({ name: 'listMembers', status: HttpStatus.OK, responseType: ListMembersResponseDto, isArray: true })
    @ApiParam({ name: 'organizationId', description: 'Organization ID' })
    @Get('organizations/:organizationId/members')
    listMembers(@Param('organizationId') organizationId: string, @Req() req: IncomingMessage) {
        return this.appService.listMembers(organizationId, fromNodeHeaders(req.headers));
    }
}
