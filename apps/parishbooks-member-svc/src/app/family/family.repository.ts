import { Injectable } from '@nestjs/common';
import { BaseRepository, Family } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class FamilyRepository extends BaseRepository<Family> {
    constructor(dataSource: DataSource) {
        super(Family, dataSource);
    }

    findById(organizationId: string, id: string): Promise<Family | null> {
        return this.findOneBy({ organizationId, id });
    }

    createFamily(data: Partial<Family>): Promise<Family> {
        return this.save(this.create(data));
    }
}
