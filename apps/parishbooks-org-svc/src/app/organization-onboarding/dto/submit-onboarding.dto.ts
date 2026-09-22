import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SubmitOnboardingDto {
    @ApiProperty({ example: 'St. Example Church' })
    @IsString()
    businessName!: string;

    @ApiProperty({ example: 'ABCDE1234F', description: 'PAN — forwarded to the payment provider, never persisted raw' })
    @IsString()
    @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN' })
    panNumber!: string;

    @ApiProperty({ example: '123456789012', description: 'Bank account number — forwarded to the payment provider, never persisted raw' })
    @IsString()
    @Length(6, 20)
    bankAccountNumber!: string;

    @ApiProperty({ example: 'HDFC0000123' })
    @IsString()
    @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'ifsc must be a valid IFSC code' })
    ifsc!: string;

    @ApiPropertyOptional({ example: '22AAAAA0000A1Z5' })
    @IsOptional()
    @IsString()
    gstin?: string;
}
