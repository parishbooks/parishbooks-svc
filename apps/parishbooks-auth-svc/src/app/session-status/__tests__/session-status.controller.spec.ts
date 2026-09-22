import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SessionStatusController } from '../session-status.controller';
import { SessionStatusService } from '../session-status.service';

describe('SessionStatusController', () => {
    let controller: SessionStatusController;
    let service: { getStatus: jest.Mock };

    beforeEach(async () => {
        service = { getStatus: jest.fn() };
        const module = await Test.createTestingModule({
            controllers: [SessionStatusController],
            providers: [
                { provide: SessionStatusService, useValue: service },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
            ],
        }).compile();

        controller = module.get(SessionStatusController);
    });

    it('delegates to the service with the sessionId path param', async () => {
        service.getStatus.mockResolvedValue({ active: true, isMember: true, activeOrganizationId: 'org-1' });

        const result = await controller.getStatus('sess-1');

        expect(service.getStatus).toHaveBeenCalledWith('sess-1');
        expect(result).toEqual({ active: true, isMember: true, activeOrganizationId: 'org-1' });
    });
});
