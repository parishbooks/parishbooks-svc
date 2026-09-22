import { Injectable } from '@nestjs/common';
import { Account, BaseRepository } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class AccountRepository extends BaseRepository<Account> {
    constructor(dataSource: DataSource) {
        super(Account, dataSource);
    }

    findById(organizationId: string, id: string): Promise<Account | null> {
        return this.findOneBy({ organizationId, id });
    }

    findByCode(organizationId: string, code: string): Promise<Account | null> {
        return this.findOneBy({ organizationId, code });
    }

    findAllByOrganization(organizationId: string): Promise<Account[]> {
        return this.findBy({ organizationId });
    }

    createAccount(data: Partial<Account>): Promise<Account> {
        return this.save(this.create(data));
    }
}
