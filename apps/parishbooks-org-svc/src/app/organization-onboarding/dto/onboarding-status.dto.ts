import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashfreeVendorStatus } from '@parishbooks/database';

export class OnboardingStatusDto {
    @ApiProperty()
    organizationId!: string;

    @ApiProperty({ enum: CashfreeVendorStatus })
    vendorStatus!: CashfreeVendorStatus;

    @ApiPropertyOptional({ type: String, nullable: true })
    vendorStatusAt!: Date | null;

    @ApiPropertyOptional({ type: String, nullable: true })
    rejectionReason?: string;
}
