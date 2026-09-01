import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
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

@Controller('identity')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @AllowAnonymous()
    @Post('sign-up')
    signUp(@Body() dto: SignUpDto) {
        return this.appService.signUp(dto);
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('sign-in')
    signIn(@Body() dto: SignInDto) {
        return this.appService.signIn(dto);
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('google/sign-in')
    googleSignIn(@Body() dto: GoogleSignInDto) {
        return this.appService.googleSignIn(dto);
    }

    @HttpCode(HttpStatus.OK)
    @Post('sign-out')
    signOut(@Req() req: IncomingMessage) {
        return this.appService.signOut(fromNodeHeaders(req.headers));
    }

    @Get('session')
    getSession(@Session() session: UserSession<typeof auth>) {
        return session;
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('verify-email')
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.appService.verifyEmail(dto);
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('resend-verification-email')
    resendVerificationEmail(@Body() dto: ResendVerificationEmailDto) {
        return this.appService.resendVerificationEmail(dto);
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.appService.forgotPassword(dto);
    }

    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.appService.resetPassword(dto);
    }

    @HttpCode(HttpStatus.OK)
    @Post('change-password')
    changePassword(@Body() dto: ChangePasswordDto, @Req() req: IncomingMessage) {
        return this.appService.changePassword(dto, fromNodeHeaders(req.headers));
    }

    @Patch('profile')
    updateProfile(@Body() dto: UpdateProfileDto, @Req() req: IncomingMessage) {
        return this.appService.updateProfile(dto, fromNodeHeaders(req.headers));
    }

    @Post('organizations')
    createOrganization(@Body() dto: CreateOrganizationDto, @Req() req: IncomingMessage) {
        return this.appService.createOrganization(dto, fromNodeHeaders(req.headers));
    }

    @Get('organizations')
    listOrganizations(@Req() req: IncomingMessage) {
        return this.appService.listOrganizations(fromNodeHeaders(req.headers));
    }

    @HttpCode(HttpStatus.OK)
    @Post('organizations/active')
    setActiveOrganization(@Body() dto: SetActiveOrganizationDto, @Req() req: IncomingMessage) {
        return this.appService.setActiveOrganization(dto, fromNodeHeaders(req.headers));
    }

    @Post('organizations/:organizationId/invitations')
    inviteMember(@Param('organizationId') organizationId: string, @Body() dto: InviteMemberDto, @Req() req: IncomingMessage) {
        return this.appService.inviteMember(organizationId, dto, fromNodeHeaders(req.headers));
    }

    @HttpCode(HttpStatus.OK)
    @Post('organizations/invitations/:invitationId/accept')
    acceptInvitation(@Param('invitationId') invitationId: string, @Req() req: IncomingMessage) {
        return this.appService.acceptInvitation({ invitationId }, fromNodeHeaders(req.headers));
    }

    @Get('organizations/:organizationId/members')
    listMembers(@Param('organizationId') organizationId: string, @Req() req: IncomingMessage) {
        return this.appService.listMembers(organizationId, fromNodeHeaders(req.headers));
    }
}
