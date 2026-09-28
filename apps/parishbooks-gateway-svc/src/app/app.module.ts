import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthContext, AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { EventsModule } from './events/events.module';
import { GivingModule } from './giving/giving.module';
import { LedgerModule } from './ledger/ledger.module';
import { MemberModule } from './member/member.module';
import { OrgModule } from './org/org.module';

/**
 * Global: AuthGuard and every per-service ProxyModule need the same
 * AuthContext instance (AuthGuard writes the session, ProxyController reads
 * it from the same AsyncLocalStorage) and HttpClientService.
 */
@Global()
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ serviceName: 'gateway-svc' }),
        HttpClientModule.forRoot(),
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
        MemberModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({ url: configService.getOrThrow<string>('MEMBER_SERVICE_URL') }),
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
    providers: [AuthContext, { provide: 'APP_GUARD', useClass: AuthGuard }],
    exports: [HttpClientModule, AuthContext],
})
export class AppModule {}
