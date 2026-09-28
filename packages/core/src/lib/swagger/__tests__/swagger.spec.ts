import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { INTERNAL_SERVICE_KEY_HEADER } from '../../guard/internal/internal-service.constants';
import { BEARER_AUTH_SCHEME, INTERNAL_SERVICE_AUTH_SCHEME } from '../constants';
import { Swagger } from '../swagger';

@Module({})
class EmptyModule {}

describe('Swagger.setup', () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await NestFactory.create(EmptyModule, { logger: false });
        Swagger.setup(app, { title: 'Probe', description: 'Probe', version: '1.0.0', path: 'docs' });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('registers bearer and internal-service-key security schemes', () => {
        const document = Swagger.createDocument(app, { title: 'Probe', description: 'Probe', version: '1.0.0', path: 'docs' });
        const schemes = document.components?.securitySchemes ?? {};

        expect(schemes[BEARER_AUTH_SCHEME]).toMatchObject({ type: 'http', scheme: 'bearer' });
        expect(schemes[INTERNAL_SERVICE_AUTH_SCHEME]).toMatchObject({ type: 'apiKey', name: INTERNAL_SERVICE_KEY_HEADER, in: 'header' });
    });
});
