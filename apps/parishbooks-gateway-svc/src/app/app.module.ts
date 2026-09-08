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
        AuthModule,
        OrgModule,
        BillingModule,
        CrmModule,
        EventsModule,
        LedgerModule,
        GivingModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
