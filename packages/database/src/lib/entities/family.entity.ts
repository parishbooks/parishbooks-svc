import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from './tenant.entity';

@Entity('family')
@Index(['organizationId', 'id'])
export class Family extends TenantEntity {
    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'jsonb', nullable: true })
    address?: Record<string, unknown>;
}
