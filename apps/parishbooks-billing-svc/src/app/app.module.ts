import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthContext, AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { DatabaseModule } from '@parishbooks/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'billing-svc' }),
        HttpClientModule.forRoot(),
        DatabaseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                url: configService.getOrThrow('DATABASE_URL'),
            }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService, AuthContext, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
