import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
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
    private readonly expectedKey: string;

    constructor(private readonly configService: ConfigService) {
        // Read once at construction so a misconfigured INTERNAL_SERVICE_KEY
        // fails at application boot, not on the first request.
        this.expectedKey = this.configService.getOrThrow<string>(INTERNAL_SERVICE_KEY_ENV_KEY);
    }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<IncomingMessage>();
        const provided = req.headers[INTERNAL_SERVICE_KEY_HEADER];
        if (!this.isValidKey(provided)) {
            this.logger.warn(`Rejected request with missing or invalid ${INTERNAL_SERVICE_KEY_HEADER}`);
            throw new UnauthorizedException();
        }
        return true;
    }

    private isValidKey(provided: string | string[] | undefined): boolean {
        if (typeof provided !== 'string') {
            return false;
        }
        const expectedBuffer = Buffer.from(this.expectedKey, 'utf8');
        const providedBuffer = Buffer.from(provided, 'utf8');
        if (expectedBuffer.length !== providedBuffer.length) {
            return false;
        }
        return timingSafeEqual(expectedBuffer, providedBuffer);
    }
}
