import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { OpenAPIObject } from '@nestjs/swagger';
import { INTERNAL_SERVICE_KEY_HEADER } from '../../guard/internal/internal-service.constants';
import { TENANT_ID_HEADER } from '../../guard/auth/auth.constants';
import { BEARER_AUTH_SCHEME, INTERNAL_SERVICE_AUTH_SCHEME } from '../constants';
import { ApiProperty } from '../decorators/swagger.decorator';

class OkDto {
    ok!: boolean;
}

@Controller('probe')
class ProbeController {
    @ApiProperty({ name: 'publicRoute', responseType: OkDto, public: true })
    @Get('public')
    publicRoute() {
        return { ok: true };
    }

    @ApiProperty({ name: 'bearerRoute', responseType: OkDto })
    @Get('bearer')
    bearerRoute() {
        return { ok: true };
    }

    @ApiProperty({ name: 'internalRoute', responseType: OkDto, internal: true })
    @Get('internal')
    internalRoute() {
        return { ok: true };
    }

    @ApiProperty({ name: 'tenantRoute', responseType: OkDto, tenantHeader: true })
    @Get('tenant')
    tenantRoute() {
        return { ok: true };
    }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

function operation(document: OpenAPIObject, path: string) {
    const op = document.paths[path]?.get;
    if (!op) throw new Error(`Missing GET ${path}`);
    return op;
}

function securityNames(document: OpenAPIObject, path: string): string[] {
    return (operation(document, path).security ?? []).flatMap((entry) => Object.keys(entry));
}

describe('ApiProperty decorator', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    beforeAll(async () => {
        app = await NestFactory.create(ProbeModule, { logger: false });
        await app.init();
        document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder()
                .addBearerAuth({ type: 'http', scheme: 'bearer' }, BEARER_AUTH_SCHEME)
                .addApiKey({ type: 'apiKey', name: INTERNAL_SERVICE_KEY_HEADER, in: 'header' }, INTERNAL_SERVICE_AUTH_SCHEME)
                .build(),
        );
    });

    afterAll(async () => {
        await app.close();
    });

    it('omits bearer auth on public routes', () => {
        expect(securityNames(document, '/probe/public')).not.toContain(BEARER_AUTH_SCHEME);
        expect(securityNames(document, '/probe/public')).not.toContain(INTERNAL_SERVICE_AUTH_SCHEME);
    });

    it('requires bearer auth on default routes', () => {
        expect(securityNames(document, '/probe/bearer')).toContain(BEARER_AUTH_SCHEME);
    });

    it('documents the internal service key instead of bearer on internal routes', () => {
        expect(securityNames(document, '/probe/internal')).toContain(INTERNAL_SERVICE_AUTH_SCHEME);
        expect(securityNames(document, '/probe/internal')).not.toContain(BEARER_AUTH_SCHEME);
    });

    it('documents x-tenant-id when tenantHeader is set', () => {
        const header = (operation(document, '/probe/tenant').parameters ?? []).find(
            (parameter) => 'name' in parameter && parameter.name === TENANT_ID_HEADER,
        );
        expect(header).toMatchObject({ in: 'header', required: true });
    });
});
