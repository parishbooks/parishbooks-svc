import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
        AuthModule.forRootAsync({ useFactory: () => ({ envKey: 'AUTH_SERVICE_URL' }) }),
        OrgModule.forRootAsync({ useFactory: () => ({ envKey: 'ORG_SERVICE_URL' }) }),
        BillingModule.forRootAsync({ useFactory: () => ({ envKey: 'BILLING_SERVICE_URL' }) }),
        CrmModule.forRootAsync({ useFactory: () => ({ envKey: 'CRM_SERVICE_URL' }) }),
        EventsModule.forRootAsync({ useFactory: () => ({ envKey: 'EVENTS_SERVICE_URL' }) }),
        LedgerModule.forRootAsync({ useFactory: () => ({ envKey: 'LEDGER_SERVICE_URL' }) }),
        GivingModule.forRootAsync({ useFactory: () => ({ envKey: 'GIVING_SERVICE_URL' }) }),
    ],
    controllers: [AppController],
    providers: [AppService, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
