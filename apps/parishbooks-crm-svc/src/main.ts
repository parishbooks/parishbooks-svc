import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.CRM_SERVICE_PORT || 3002,
    swagger: { title: 'ParishBooks CRM Service', description: 'ParishBooks CRM Service', version: '1.0.0' },
});
