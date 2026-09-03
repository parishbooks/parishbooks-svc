import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    name!: string;

    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'super-secret', minLength: 6 })
    @IsString()
    @MinLength(6)
    password!: string;

    @ApiPropertyOptional({ description: 'URL to redirect to after sign-up' })
    @IsOptional()
    @IsString()
    callbackURL?: string;
}

export class SignInDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'super-secret' })
    @IsString()
    password!: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}

export class ForgotPasswordDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ description: 'URL to redirect to after resetting the password' })
    @IsOptional()
    @IsString()
    redirectTo?: string;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'new-super-secret', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword!: string;

    @ApiProperty({ description: 'Password reset token received via email' })
    @IsString()
    token!: string;
}

export class SendEmailOtpDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;
}

export class VerifyEmailOtpDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '123456', description: 'OTP received via email' })
    @IsString()
    otp!: string;
}

export class ChangePasswordDto {
    @ApiProperty({ example: 'super-secret' })
    @IsString()
    currentPassword!: string;

    @ApiProperty({ example: 'new-super-secret', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword!: string;

    @ApiPropertyOptional({ default: false, description: 'Revoke all other active sessions' })
    @IsOptional()
    @IsBoolean()
    revokeOtherSessions?: boolean;
}

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'Jane Doe' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Profile image URL' })
    @IsOptional()
    @IsString()
    image?: string;
}
