import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { INTERNAL_SERVICE_KEY_HEADER } from '../guard/internal/internal-service.constants';
import { BEARER_AUTH_SCHEME, INTERNAL_SERVICE_AUTH_SCHEME } from './constants';
import { SwaggerOptions } from './types/swagger.types';

export class Swagger {
    static createDocument(app: INestApplication, options: SwaggerOptions): OpenAPIObject {
        const config = new DocumentBuilder()
            .setTitle(options.title)
            .setDescription(options.description)
            .setVersion(options.version)
            .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Session bearer token issued by BetterAuth' }, BEARER_AUTH_SCHEME)
            .addApiKey(
                { type: 'apiKey', name: INTERNAL_SERVICE_KEY_HEADER, in: 'header', description: 'Shared secret for service-to-service calls' },
                INTERNAL_SERVICE_AUTH_SCHEME,
            )
            .build();
        return SwaggerModule.createDocument(app, config);
    }

    static setup(app: INestApplication, options: SwaggerOptions) {
        const document = this.createDocument(app, options);
        SwaggerModule.setup(options.path, app, document, { useGlobalPrefix: true });
    }
}
