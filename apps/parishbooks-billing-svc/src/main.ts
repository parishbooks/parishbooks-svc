import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.BILLING_SERVICE_PORT || 8002,
    swagger: { title: 'ParishBooks Billing Service', description: 'ParishBooks Billing Service', version: '1.0.0' },
});
