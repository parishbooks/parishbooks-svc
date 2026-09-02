import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGuard, HttpClientModule, LoggerModule } from '@parishbooks/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), LoggerModule.forRoot({ serviceName: 'billing-svc' }), HttpClientModule.forRoot()],
    controllers: [AppController],
    providers: [AppService, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
