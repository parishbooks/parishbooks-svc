import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpClientModule, HttpClientService, LoggerModule } from '@parishbooks/core';
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
            inject: [ConfigService, HttpClientService],
            useFactory: async (configService: ConfigService, httpClient: HttpClientService) => ({
                auth: betterAuthConfig(
                    {
                        secret: configService.getOrThrow('BETTER_AUTH_SECRET'),
                        baseURL: configService.getOrThrow('BETTER_AUTH_URL'),
                        databaseURL: configService.getOrThrow('DATABASE_URL'),
                        googleClientId: configService.getOrThrow('GOOGLE_CLIENT_ID'),
                        googleClientSecret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
                        stripeSecretKey: configService.getOrThrow('STRIPE_SECRET_KEY'),
                        stripeWebhookSecret: configService.getOrThrow('STRIPE_WEBHOOK_SECRET'),
                        stripeStarterPriceId: configService.getOrThrow('STRIPE_STARTER_PRICE_ID'),
                        stripeProPriceId: configService.getOrThrow('STRIPE_PRO_PRICE_ID'),
                        orgServiceUrl: configService.getOrThrow('ORG_SERVICE_URL'),
                        internalServiceKey: configService.getOrThrow('INTERNAL_SERVICE_KEY'),
                    },
                    httpClient,
                ),
            }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService, UserHook],
})
export class AppModule {}
