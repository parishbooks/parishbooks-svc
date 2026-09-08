import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'node:http';
import { INTERNAL_SERVICE_KEY_ENV_KEY, INTERNAL_SERVICE_KEY_HEADER } from './internal-service.constants';

/**
 * Guards service-to-service-only endpoints with a static shared secret
 * (INTERNAL_SERVICE_KEY, same value on caller and callee). A deliberate v1
 * simplification vs. the JWT-rotation scheme in
 * docs/architecture/microservices-http.md §5 — apply directly with
 * @UseGuards(InternalServiceGuard) per-route, never as APP_GUARD, and pair
 * with @Public() so the user-facing AuthGuard doesn't also demand a Bearer
 * token these calls don't carry.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
    private readonly logger = new Logger(InternalServiceGuard.name);

    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<IncomingMessage>();
        const expected = this.configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY);
        const provided = req.headers[INTERNAL_SERVICE_KEY_HEADER];
        if (provided !== expected) {
            this.logger.warn(`Rejected request with missing or invalid ${INTERNAL_SERVICE_KEY_HEADER}`);
            throw new UnauthorizedException();
        }
        return true;
    }
}
