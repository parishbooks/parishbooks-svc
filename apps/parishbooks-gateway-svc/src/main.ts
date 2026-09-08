import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.GATEWAY_SERVICE_PORT || 3007,
    swagger: { title: 'ParishBooks Gateway Service', description: 'ParishBooks API Gateway', version: '1.0.0' },
});
