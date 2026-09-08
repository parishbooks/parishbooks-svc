import { Pool } from 'pg';
import { SessionStatusRepository } from './session-status.repository';

describe('SessionStatusRepository#findStatus', () => {
    let pool: { query: jest.Mock };
    let repository: SessionStatusRepository;

    beforeEach(() => {
        pool = { query: jest.fn() };
        repository = new SessionStatusRepository(pool as unknown as Pool);
    });

    it('returns active status with membership when a live session row is found', async () => {
        pool.query.mockResolvedValue({ rows: [{ activeOrganizationId: 'org-1', isMember: true }] });

        const result = await repository.findStatus('sess-1');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM auth.session'), ['sess-1']);
        expect(result).toEqual({ active: true, isMember: true, activeOrganizationId: 'org-1' });
    });

    it('returns inactive when no matching live session row exists', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findStatus('sess-missing');

        expect(result).toEqual({ active: false, isMember: false, activeOrganizationId: null });
    });

    it('returns isMember false when the session has an active org but no matching member row', async () => {
        pool.query.mockResolvedValue({ rows: [{ activeOrganizationId: 'org-1', isMember: false }] });

        const result = await repository.findStatus('sess-1');

        expect(result).toEqual({ active: true, isMember: false, activeOrganizationId: 'org-1' });
    });
});
