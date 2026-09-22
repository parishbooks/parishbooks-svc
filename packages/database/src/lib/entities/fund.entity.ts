import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

export enum FundType {
    GENERAL = 'general',
    RESTRICTED = 'restricted',
    BUILDING = 'building',
    MISSION = 'mission',
}

@Entity('fund')
@Index(['organizationId', 'id'])
export class Fund extends TenantEntity {
    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'enum', enum: FundType })
    type!: FundType;

    // Foreign-contribution eligibility — CLAUDE.md rule 6, FCRA segregation
    // rules in docs/compliance/tax-receipts-80g-501c3.md §2.
    @Column({ type: 'boolean', default: false })
    fcraFlag!: boolean;
}
