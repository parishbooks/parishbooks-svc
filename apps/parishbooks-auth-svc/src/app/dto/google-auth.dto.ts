import { IsOptional, IsString } from 'class-validator';

export class GoogleSignInDto {
    @IsOptional()
    @IsString()
    callbackURL?: string;
}
