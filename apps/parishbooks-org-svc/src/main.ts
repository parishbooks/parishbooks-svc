import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.ORG_SERVICE_PORT || 3006,
    swagger: { title: 'ParishBooks Org Service', description: 'ParishBooks Org Service', version: '1.0.0' },
});
