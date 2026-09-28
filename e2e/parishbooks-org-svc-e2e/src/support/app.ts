import '@parishbooks/e2e-supertest/env';
import { INestApplication } from '@nestjs/common';
import { Application } from '@parishbooks/core';
import { AppModule } from '../../../../apps/parishbooks-org-svc/src/app/app.module';

let app: INestApplication;

beforeAll(async () => {
    app = await Application.create({
        module: AppModule,
        rawBody: true,
        swagger: { title: 'ParishBooks Org Service', description: 'ParishBooks Org Service', version: '1.0.0' },
    });
}, 60_000);

afterAll(async () => {
    await app?.close();
});

export function httpServer(): ReturnType<INestApplication['getHttpServer']> {
    if (!app) throw new Error('E2E app not initialized');
    return app.getHttpServer();
}
