import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard, LoggerModule } from '@parishbooks/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CrmModule } from './crm/crm.module';
import { EventsModule } from './events/events.module';
import { GatewayCoreModule } from './core/gateway-core.module';
import { GivingModule } from './giving/giving.module';
import { LedgerModule } from './ledger/ledger.module';
import { OrgModule } from './org/org.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'gateway-svc' }),
        GatewayCoreModule,
        AuthModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('AUTH_SERVICE_URL') }),
        }),
        OrgModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('ORG_SERVICE_URL') }),
        }),
        BillingModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('BILLING_SERVICE_URL') }),
        }),
        CrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('CRM_SERVICE_URL') }),
        }),
        EventsModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('EVENTS_SERVICE_URL') }),
        }),
        LedgerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('LEDGER_SERVICE_URL') }),
        }),
        GivingModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('GIVING_SERVICE_URL') }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
