import '@parishbooks/e2e-supertest/env';
import { INestApplication } from '@nestjs/common';
import { Application } from '@parishbooks/core';
import { e2eConfig } from '@parishbooks/e2e-supertest';
import { AppModule as AuthAppModule } from '@parishbooks/parishbooks-auth-svc/testing';
import { AppModule as OrgAppModule } from '@parishbooks/parishbooks-org-svc/testing';
import { AppModule as GatewayAppModule } from '../../../../apps/parishbooks-gateway-svc/src/app/app.module';

let authApp: INestApplication;
let orgApp: INestApplication;
let gatewayApp: INestApplication;
let suiteCount = 0;
let bootstrap: Promise<void> | undefined;

async function startApps(): Promise<void> {
    process.env.ORG_SERVICE_URL = `http://127.0.0.1:${e2eConfig.orgPort}`;
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${e2eConfig.authPort}/api`;
    process.env.BETTER_AUTH_URL = `http://127.0.0.1:${e2eConfig.authPort}`;

    orgApp = await Application.create({
        module: OrgAppModule,
        rawBody: true,
        swagger: { title: 'ParishBooks Org Service', description: 'ParishBooks Org Service', version: '1.0.0' },
    });
    await orgApp.listen(e2eConfig.orgPort);

    authApp = await Application.create({
        module: AuthAppModule,
        bodyParser: false,
        swagger: { title: 'ParishBooks Auth Service', description: 'ParishBooks Auth Service', version: '1.0.0' },
    });
    await authApp.listen(e2eConfig.authPort);

    gatewayApp = await Application.create({
        module: GatewayAppModule,
        swagger: { title: 'ParishBooks Gateway Service', description: 'ParishBooks API Gateway', version: '1.0.0' },
    });
}

async function stopApps(): Promise<void> {
    if (gatewayApp) await gatewayApp.close();
    if (authApp) await authApp.close();
    if (orgApp) await orgApp.close();
}

beforeAll(async () => {
    suiteCount++;
    if (!bootstrap) bootstrap = startApps();
    await bootstrap;
}, 120_000);

afterAll(async () => {
    suiteCount--;
    if (suiteCount > 0) return;
    await stopApps();
    bootstrap = undefined;
});

export function authHttpServer(): ReturnType<INestApplication['getHttpServer']> {
    if (!authApp) throw new Error('Auth E2E app not initialized');
    return authApp.getHttpServer();
}

export function gatewayHttpServer(): ReturnType<INestApplication['getHttpServer']> {
    if (!gatewayApp) throw new Error('Gateway E2E app not initialized');
    return gatewayApp.getHttpServer();
}
