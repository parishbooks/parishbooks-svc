import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AUTH_DB_POOL } from './session-status.constants';

export interface SessionStatusRow {
    active: boolean;
    isMember: boolean;
    activeOrganizationId: string | null;
}

const SESSION_STATUS_QUERY = `
    SELECT s."activeOrganizationId",
           EXISTS (
               SELECT 1 FROM auth.member m
               WHERE m."organizationId"::text = s."activeOrganizationId"::text AND m."userId"::text = s."userId"
           ) AS "isMember"
    FROM auth.session s
    WHERE s.id = $1::uuid AND s."expiresAt" > now()
`;

@Injectable()
export class SessionStatusRepository {
    constructor(@Inject(AUTH_DB_POOL) private readonly pool: Pool) {}

    async findStatus(sessionId: string): Promise<SessionStatusRow> {
        const result = await this.pool.query<{ activeOrganizationId: string | null; isMember: boolean }>(SESSION_STATUS_QUERY, [sessionId]);
        const row = result.rows[0];
        if (!row) return { active: false, isMember: false, activeOrganizationId: null };
        return { active: true, isMember: row.isMember, activeOrganizationId: row.activeOrganizationId };
    }
}
