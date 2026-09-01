import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { betterAuthConfig } from '../libs/auth.config';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                auth: betterAuthConfig({
                    secret: configService.getOrThrow('AUTH_SECRET'),
                    baseURL: configService.getOrThrow('AUTH_BASE_URL'),
                    databaseURL: configService.getOrThrow('AUTH_DATABASE_URL'),
                    googleClientId: configService.getOrThrow('AUTH_GOOGLE_CLIENT_ID'),
                    googleClientSecret: configService.getOrThrow('AUTH_GOOGLE_CLIENT_SECRET'),
                }),
            }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
