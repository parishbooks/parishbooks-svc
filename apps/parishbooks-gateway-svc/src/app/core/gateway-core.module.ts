import { Global, Module } from '@nestjs/common';
import { AuthContext, HttpClientModule } from '@parishbooks/core';

/**
 * AuthGuard and every per-service ProxyModule need the same AuthContext
 * instance (AuthGuard writes the session, ProxyController reads it from the
 * same AsyncLocalStorage) and HttpClientService. Global so feature modules
 * don't each need to re-import/re-declare them.
 */
@Global()
@Module({
    imports: [HttpClientModule.forRoot()],
    providers: [AuthContext],
    exports: [HttpClientModule, AuthContext],
})
export class GatewayCoreModule {}
