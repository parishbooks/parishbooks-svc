import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

Application.bootstrap({
    module: AppModule,
    port: process.env.GIVING_SERVICE_PORT || 8005,
    swagger: { title: 'ParishBooks Giving Service', description: 'ParishBooks Giving Service', version: '1.0.0' },
});
