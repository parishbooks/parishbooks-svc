import { Injectable } from '@nestjs/common';
import { BaseRepository, JournalLine } from '@parishbooks/database';
import { DataSource } from 'typeorm';

// Append-only, same as JournalEntry — no update method.
@Injectable()
export class JournalLineRepository extends BaseRepository<JournalLine> {
    constructor(dataSource: DataSource) {
        super(JournalLine, dataSource);
    }

    findByJournalEntryId(organizationId: string, journalEntryId: string): Promise<JournalLine[]> {
        return this.findBy({ organizationId, journalEntryId });
    }

    createLines(data: Partial<JournalLine>[]): Promise<JournalLine[]> {
        return this.save(this.create(data));
    }
}
