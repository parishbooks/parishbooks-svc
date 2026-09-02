import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthSession, AuthUser } from './auth.types';

@Injectable()
export class AuthContext {
    private readonly storage = new AsyncLocalStorage<AuthSession>();

    run<T>(session: AuthSession, callback: () => T): T {
        return this.storage.run(session, callback);
    }

    /**
     * Sets the session for the rest of the current async chain without a
     * wrapping callback. Used by AuthGuard, since CanActivate has no "rest of
     * the request" callback to pass to `run()` — it just returns true and lets
     * Nest continue within the same async continuation.
     */
    enterWith(session: AuthSession): void {
        this.storage.enterWith(session);
    }

    getSession(): AuthSession | undefined {
        return this.storage.getStore();
    }

    getUser(): AuthUser | undefined {
        return this.storage.getStore()?.user;
    }
}
