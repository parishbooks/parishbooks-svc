import { QueryFailedError } from 'typeorm';
import { WebhookProvider } from '../../entities/processed-webhook-event.entity';
import { ProcessedWebhookEventRepository } from '../processed-webhook-event.repository';

describe('ProcessedWebhookEventRepository.markProcessedIfNew', () => {
    const data = { provider: WebhookProvider.CASHFREE, eventId: 'evt-1', eventType: 'VENDOR_KYC_UPDATE' };

    function buildRepository(save: jest.Mock): ProcessedWebhookEventRepository {
        const repository = Object.create(ProcessedWebhookEventRepository.prototype) as ProcessedWebhookEventRepository;
        Object.assign(repository, { create: jest.fn((d) => d), save });
        return repository;
    }

    it('returns true and inserts when the event has not been claimed yet', async () => {
        const save = jest.fn().mockResolvedValue({ id: 'row-1', ...data, processedAt: new Date() });
        const repository = buildRepository(save);

        const result = await repository.markProcessedIfNew(data);

        expect(result).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('returns false without throwing when a concurrent insert already claimed the event', async () => {
        const uniqueViolation = new QueryFailedError('INSERT ...', [], { code: '23505', name: 'error' } as unknown as Error);
        const save = jest.fn().mockRejectedValue(uniqueViolation);
        const repository = buildRepository(save);

        const result = await repository.markProcessedIfNew(data);

        expect(result).toBe(false);
    });

    it('rethrows a database error that is not a unique-constraint violation', async () => {
        const otherError = new QueryFailedError('INSERT ...', [], { code: '08006', name: 'error' } as unknown as Error);
        const save = jest.fn().mockRejectedValue(otherError);
        const repository = buildRepository(save);

        await expect(repository.markProcessedIfNew(data)).rejects.toThrow(otherError);
    });
});
