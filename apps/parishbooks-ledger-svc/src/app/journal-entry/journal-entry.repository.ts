import { Injectable } from '@nestjs/common';
import { BaseRepository, JournalEntry } from '@parishbooks/database';
import { DataSource } from 'typeorm';

// Append-only (CLAUDE.md rule 2, enforced in the DB — see migration
// AddJournalImmutabilityTriggers). No update method: corrections are a
// new row via createEntry with reversalOfEntryId set, never a mutation
// of an existing one.
@Injectable()
export class JournalEntryRepository extends BaseRepository<JournalEntry> {
    constructor(dataSource: DataSource) {
        super(JournalEntry, dataSource);
    }

    findById(organizationId: string, id: string): Promise<JournalEntry | null> {
        return this.findOneBy({ organizationId, id });
    }

    findBySourceId(organizationId: string, sourceId: string): Promise<JournalEntry[]> {
        return this.findBy({ organizationId, sourceId });
    }

    createEntry(data: Partial<JournalEntry>): Promise<JournalEntry> {
        return this.save(this.create(data));
    }
}
