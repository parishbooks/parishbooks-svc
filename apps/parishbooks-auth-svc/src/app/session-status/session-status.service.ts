import { Injectable } from '@nestjs/common';
import { SessionStatusRepository, SessionStatusRow } from './session-status.repository';

@Injectable()
export class SessionStatusService {
    constructor(private readonly repository: SessionStatusRepository) {}

    getStatus(sessionId: string): Promise<SessionStatusRow> {
        return this.repository.findStatus(sessionId);
    }
}
