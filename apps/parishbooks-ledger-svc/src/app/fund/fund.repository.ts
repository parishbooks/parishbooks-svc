import { Injectable } from '@nestjs/common';
import { BaseRepository, Fund } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class FundRepository extends BaseRepository<Fund> {
    constructor(dataSource: DataSource) {
        super(Fund, dataSource);
    }

    findById(organizationId: string, id: string): Promise<Fund | null> {
        return this.findOneBy({ organizationId, id });
    }

    findAllByOrganization(organizationId: string): Promise<Fund[]> {
        return this.findBy({ organizationId });
    }

    createFund(data: Partial<Fund>): Promise<Fund> {
        return this.save(this.create(data));
    }
}
