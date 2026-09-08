import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.LEDGER_SERVICE_PORT || 8006,
    swagger: { title: 'ParishBooks Ledger Service', description: 'ParishBooks Ledger Service', version: '1.0.0' },
});
