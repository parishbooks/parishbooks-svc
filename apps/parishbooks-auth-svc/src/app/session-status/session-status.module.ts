import { DynamicModule, Module, Provider } from '@nestjs/common';
import { buildConnectionPool } from '../../utils/auth.utils';
import { AUTH_DB_POOL, SESSION_STATUS_MODULE_OPTIONS } from './session-status.constants';
import { SessionStatusController } from './session-status.controller';
import { SessionStatusRepository } from './session-status.repository';
import { SessionStatusService } from './session-status.service';
import { SessionStatusModuleAsyncOptions, SessionStatusModuleOptions } from './session-status.types';

@Module({})
export class SessionStatusModule {
    static forRootAsync(options: SessionStatusModuleAsyncOptions): DynamicModule {
        const optionsProvider: Provider = {
            provide: SESSION_STATUS_MODULE_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject ?? [],
        };

        const poolProvider: Provider = {
            provide: AUTH_DB_POOL,
            useFactory: (moduleOptions: SessionStatusModuleOptions) => buildConnectionPool(moduleOptions.databaseUrl),
            inject: [SESSION_STATUS_MODULE_OPTIONS],
        };

        return {
            module: SessionStatusModule,
            imports: options.imports ?? [],
            controllers: [SessionStatusController],
            providers: [optionsProvider, poolProvider, SessionStatusService, SessionStatusRepository],
        };
    }
}
