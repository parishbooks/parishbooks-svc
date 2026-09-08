import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.EVENTS_SERVICE_PORT || 8004,
    swagger: { title: 'ParishBooks Events Service', description: 'ParishBooks Events Service', version: '1.0.0' },
});
