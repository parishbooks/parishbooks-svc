import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpClientModule, LoggerModule } from '@parishbooks/core';
import { DatabaseModule } from '@parishbooks/database';
import { betterAuthConfig } from '../libs/auth.config';
import { UserHook } from './hooks/db-operation/user.hook';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'auth-svc' }),
        HttpClientModule.forRoot(),
        DatabaseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                url: configService.getOrThrow('DATABASE_URL'),
            }),
        }),
        AuthModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                auth: betterAuthConfig({
                    secret: configService.getOrThrow('BETTER_AUTH_SECRET'),
                    baseURL: configService.getOrThrow('BETTER_AUTH_URL'),
                    databaseURL: configService.getOrThrow('DATABASE_URL'),
                    googleClientId: configService.getOrThrow('GOOGLE_CLIENT_ID'),
                    googleClientSecret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
                }),
            }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService, UserHook],
})
export class AppModule {}
