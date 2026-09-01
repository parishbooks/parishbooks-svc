import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsOptional()
    @IsString()
    callbackURL?: string;
}

export class SignInDto {
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;

    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}

export class ForgotPasswordDto {
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    redirectTo?: string;
}

export class ResetPasswordDto {
    @IsString()
    @MinLength(6)
    newPassword!: string;

    @IsString()
    token!: string;
}

export class VerifyEmailDto {
    @IsString()
    token!: string;
}

export class ResendVerificationEmailDto {
    @IsEmail()
    email!: string;
}

export class ChangePasswordDto {
    @IsString()
    currentPassword!: string;

    @IsString()
    @MinLength(6)
    newPassword!: string;

    @IsOptional()
    @IsBoolean()
    revokeOtherSessions?: boolean;
}

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    image?: string;
}
