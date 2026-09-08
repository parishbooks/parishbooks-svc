import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    bodyParser: false,
    port: process.env.AUTH_SERVICE_PORT || 8001,
    swagger: { title: 'ParishBooks Auth Service', description: 'ParishBooks Auth Service', version: '1.0.0' },
});
