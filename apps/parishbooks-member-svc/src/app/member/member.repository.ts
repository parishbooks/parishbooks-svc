import { Injectable } from '@nestjs/common';
import { BaseRepository, Member } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class MemberRepository extends BaseRepository<Member> {
    constructor(dataSource: DataSource) {
        super(Member, dataSource);
    }

    findById(organizationId: string, id: string): Promise<Member | null> {
        return this.findOneBy({ organizationId, id });
    }

    findByBetterAuthUserId(organizationId: string, betterAuthUserId: string): Promise<Member | null> {
        return this.findOneBy({ organizationId, betterAuthUserId });
    }

    createMember(data: Partial<Member>): Promise<Member> {
        return this.save(this.create(data));
    }
}
