import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildConnectionPool } from '../../utils/auth.utils';
import { AUTH_DB_POOL } from './session-status.constants';
import { SessionStatusController } from './session-status.controller';
import { SessionStatusRepository } from './session-status.repository';
import { SessionStatusService } from './session-status.service';

@Module({
    imports: [ConfigModule],
    controllers: [SessionStatusController],
    providers: [
        SessionStatusService,
        SessionStatusRepository,
        {
            provide: AUTH_DB_POOL,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => buildConnectionPool(configService.getOrThrow('DATABASE_URL')),
        },
    ],
})
export class SessionStatusModule {}
