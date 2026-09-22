import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthContext, AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { DatabaseModule } from '@parishbooks/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationOnboardingModule } from './organization-onboarding/organization-onboarding.module';
import { OrganizationProfileModule } from './organization-profile/organization-profile.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'org-svc' }),
        HttpClientModule.forRoot(),
        DatabaseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                url: configService.getOrThrow('DATABASE_URL'),
            }),
        }),
        OrganizationProfileModule,
        OrganizationOnboardingModule,
    ],
    controllers: [AppController],
    providers: [AppService, AuthContext, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
