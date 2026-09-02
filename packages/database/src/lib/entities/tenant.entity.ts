import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

// Subclasses must add @Entity(...) plus @Index(['organizationId', 'id']) —
// see docs/specs/typeorm-database-schema.md §2. Every tenant-scoped query
// must filter on organizationId (CLAUDE.md rule 1).
@Index(['organizationId'])
export abstract class TenantEntity extends BaseEntity {
    @Column({ type: 'uuid' })
    organizationId!: string;
}
