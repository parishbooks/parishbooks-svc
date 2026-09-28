import { Global, Module } from '@nestjs/common';
import { AuthContext } from './auth-context';

/**
 * `@Global()` so any feature module in the app can inject AuthContext
 * without importing this module itself. AuthContext wraps a single
 * AsyncLocalStorage instance that AuthGuard populates once per request —
 * a feature module that instead listed `AuthContext` directly in its own
 * `providers` would get a *separate* instance with its own empty storage,
 * so it would always read an empty session regardless of what AuthGuard
 * resolved. Import this module in the app's AppModule (in place of
 * providing AuthContext directly) so every module shares the one instance.
 */
@Global()
@Module({
    providers: [AuthContext],
    exports: [AuthContext],
})
export class AuthContextModule {}
