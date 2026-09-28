import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AuthContext, INTERNAL_SERVICE_AUTH_SCHEME, INTERNAL_SERVICE_KEY_HEADER, InternalServiceGuard } from '@parishbooks/core';
import { ProcessedWebhookEventRepository } from '@parishbooks/database';
import { OrganizationOnboardingWebhookController } from '../organization-onboarding/organization-onboarding-webhook.controller';
import { OrganizationOnboardingController } from '../organization-onboarding/organization-onboarding.controller';
import { OrganizationOnboardingService } from '../organization-onboarding/organization-onboarding.service';
import { VendorProvider } from '../organization-onboarding/provider/vendor-provider';
import { OrganizationProfileController } from '../organization-profile/organization-profile.controller';
import { OrganizationProfileService } from '../organization-profile/organization-profile.service';

function schemaProperties(document: OpenAPIObject, name: string): string[] {
    const schema = document.components?.schemas?.[name];
    if (!schema || !('properties' in schema) || !schema.properties) throw new Error(`Missing schema ${name}`);
    return Object.keys(schema.properties);
}

function securityNames(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch'): string[] {
    return (document.paths[path]?.[method]?.security ?? []).flatMap((entry) => Object.keys(entry));
}

function headerParams(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch') {
    return (document.paths[path]?.[method]?.parameters ?? []).filter(
        (parameter): parameter is { name: string; in: string; required?: boolean } => 'name' in parameter && 'in' in parameter && parameter.in === 'header',
    );
}

function headerNames(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch'): string[] {
    return headerParams(document, path, method).map((parameter) => parameter.name);
}

describe('org-svc OpenAPI document', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [OrganizationProfileController, OrganizationOnboardingController, OrganizationOnboardingWebhookController],
            providers: [
                InternalServiceGuard,
                { provide: OrganizationProfileService, useValue: {} },
                { provide: OrganizationOnboardingService, useValue: {} },
                { provide: AuthContext, useValue: {} },
                { provide: VendorProvider, useValue: {} },
                { provide: ProcessedWebhookEventRepository, useValue: {} },
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
        await app.close();
    });

    it('documents the profile fields the entity actually returns', () => {
        expect(schemaProperties(document, 'OrganizationProfileDto')).toEqual(
            expect.arrayContaining([
                'updatedAt',
                'ein',
                'cashfreeVendorId',
                'cashfreeVendorStatus',
                'cashfreeVendorStatusAt',
                'cashfreeVendorRejectionReason',
            ]),
        );
    });

    it('requires x-tenant-id on user-facing profile and onboarding routes', () => {
        for (const [path, method] of [
            ['/api/organizations/{organizationId}/profile', 'get'],
            ['/api/organizations/{organizationId}/profile', 'patch'],
            ['/api/organizations/{organizationId}/onboarding', 'post'],
            ['/api/organizations/{organizationId}/onboarding/status', 'get'],
        ] as const) {
            const tenantHeaders = headerParams(document, path, method).filter((parameter) => parameter.name === 'x-tenant-id');
            expect(tenantHeaders).toHaveLength(1);
            expect(tenantHeaders[0]).toMatchObject({ required: true });
        }
    });

    it('documents create-profile and billing-sync as internal-service routes', () => {
        expect(securityNames(document, '/api/organizations/{organizationId}/profile', 'post')).toContain(INTERNAL_SERVICE_AUTH_SCHEME);
        expect(securityNames(document, '/api/organizations/{organizationId}/profile', 'post')).not.toContain('bearer');
        expect(headerNames(document, '/api/organizations/{organizationId}/profile', 'post')).toContain('x-tenant-id');

        expect(securityNames(document, '/api/organizations/{organizationId}/billing-sync', 'patch')).toContain(INTERNAL_SERVICE_AUTH_SCHEME);
        expect(securityNames(document, '/api/organizations/{organizationId}/billing-sync', 'patch')).not.toContain('bearer');
    });

    it('excludes the vendor webhook from the public OpenAPI document', () => {
        expect(document.paths['/api/organizations/onboarding/webhook']).toBeUndefined();
    });
});
