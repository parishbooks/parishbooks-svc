import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getAuthSessionFromRequest } from './auth-request';
import { AuthUser } from './auth.types';

/** Opaque Better Auth session bearer from the verified JWT (for auth-svc identity API calls). */
export const SessionToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
    const sessionToken = getAuthSessionFromRequest(ctx.switchToHttp().getRequest())?.sessionToken;
    if (!sessionToken) throw new UnauthorizedException();
    return sessionToken;
});

/** Authenticated user from AuthGuard; pass a key to read a single field (e.g. `@CurrentUser('email')`). */
export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] | undefined => {
    const user = getAuthSessionFromRequest(ctx.switchToHttp().getRequest())?.user;
    if (!user) return undefined;
    return data ? user[data] : user;
});
