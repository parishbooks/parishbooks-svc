jest.mock('../../auth', () => ({ auth: {} }));

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { INTERNAL_SERVICE_AUTH_SCHEME, INTERNAL_SERVICE_KEY_HEADER, InternalServiceGuard } from '@parishbooks/core';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { SessionStatusController } from '../session-status/session-status.controller';
import { SessionStatusService } from '../session-status/session-status.service';

function schemaProperties(document: OpenAPIObject, name: string): string[] {
    const schema = document.components?.schemas?.[name];
    if (!schema || !('properties' in schema) || !schema.properties) throw new Error(`Missing schema ${name}`);
    return Object.keys(schema.properties);
}

function jsonSchema(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch', status: string) {
    return document.paths[path]?.[method]?.responses?.[status]?.content?.['application/json']?.schema;
}

function schemaRefName(schema: unknown): string {
    if (!schema || typeof schema !== 'object' || !('$ref' in schema) || typeof schema.$ref !== 'string') throw new Error('Expected a $ref schema');
    const name = schema.$ref.split('/').pop();
    if (!name) throw new Error(`Could not parse schema ref ${schema.$ref}`);
    return name;
}

function securityNames(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch'): string[] {
    return (document.paths[path]?.[method]?.security ?? []).flatMap((entry) => Object.keys(entry));
}

describe('auth-svc OpenAPI document', () => {
    let app: INestApplication | undefined;
    let document: OpenAPIObject;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AppController, SessionStatusController],
            providers: [
                InternalServiceGuard,
                { provide: AppService, useValue: {} },
                { provide: SessionStatusService, useValue: {} },
                { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('test-key') } },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();

        document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().addApiKey({ type: 'apiKey', name: INTERNAL_SERVICE_KEY_HEADER, in: 'header' }, INTERNAL_SERVICE_AUTH_SCHEME).build(),
        );
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    it('documents activeOrganizationId on the session object', () => {
        expect(schemaProperties(document, 'SessionDto')).toContain('activeOrganizationId');
    });

    it('describes sign-up token as the minted JWT', () => {
        const schema = document.components?.schemas?.SignUpResponseDto;
        if (!schema || !('properties' in schema)) throw new Error('Missing SignUpResponseDto');
        expect(schema.properties?.token).toMatchObject({ description: expect.stringMatching(/JWT/i) });
    });

    it('does not advertise a JWT on create-organization', () => {
        const name = schemaRefName(jsonSchema(document, '/api/identity/organizations', 'post', '201'));
        expect(schemaProperties(document, name)).not.toContain('token');
        expect(schemaProperties(document, name)).not.toContain('sessionToken');
    });

    it('advertises token and sessionToken on set-active-organization', () => {
        const name = schemaRefName(jsonSchema(document, '/api/identity/organizations/active', 'post', '200'));
        expect(schemaProperties(document, name)).toEqual(expect.arrayContaining(['token', 'sessionToken']));
    });

    it('documents list-members as a { members, total } object, not an array', () => {
        const schema = jsonSchema(document, '/api/identity/organizations/{organizationId}/members', 'get', '200');
        expect(schema).toEqual({ $ref: '#/components/schemas/ListMembersResponseDto' });
    });

    it('documents session-status as an internal-service route', () => {
        expect(securityNames(document, '/api/identity/session/{sessionId}/status', 'get')).toContain(INTERNAL_SERVICE_AUTH_SCHEME);
        expect(securityNames(document, '/api/identity/session/{sessionId}/status', 'get')).not.toContain('bearer');
    });
});
