import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GoogleSignInDto {
    @ApiPropertyOptional({ description: 'URL to redirect to after Google sign-in' })
    @IsOptional()
    @IsString()
    callbackURL?: string;
}
