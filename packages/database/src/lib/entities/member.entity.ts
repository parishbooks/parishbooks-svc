import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

// Minimal donor-identity slice for Phase 1 receipting — see
// docs/architecture/phase1-giving-ledger-schema-design.md. Does not carry
// membershipStatus/wardId/prayerCellId/dob; those are CRM-phase columns
// (docs/specs/crm-family-units.md) added when that phase starts.
@Entity('member')
@Index(['organizationId', 'id'])
export class Member extends TenantEntity {
    @Column({ type: 'uuid', nullable: true })
    familyId?: string;

    @Column({ type: 'text' })
    firstName!: string;

    @Column({ type: 'text' })
    lastName!: string;

    @Column({ type: 'text', nullable: true })
    email?: string;

    @Column({ type: 'text', nullable: true })
    phone?: string;

    @Column({ type: 'text', nullable: true })
    panNumber?: string;

    @Column({ type: 'uuid', nullable: true })
    betterAuthUserId?: string;
}
