import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalServiceGuard } from '../internal-service.guard';

function buildContext(headers: Record<string, string>): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
}

describe('InternalServiceGuard', () => {
    let guard: InternalServiceGuard;
    let configService: { getOrThrow: jest.Mock };

    beforeEach(() => {
        configService = { getOrThrow: jest.fn().mockReturnValue('shared-secret') };
        guard = new InternalServiceGuard(configService as unknown as ConfigService);
    });

    it('rejects a request with no internal service key header', () => {
        expect(() => guard.canActivate(buildContext({}))).toThrow(UnauthorizedException);
    });

    it('rejects a request with the wrong key', () => {
        expect(() => guard.canActivate(buildContext({ 'x-internal-service-key': 'wrong' }))).toThrow(UnauthorizedException);
    });

    it('accepts a request with the correct key', () => {
        expect(guard.canActivate(buildContext({ 'x-internal-service-key': 'shared-secret' }))).toBe(true);
    });
});
