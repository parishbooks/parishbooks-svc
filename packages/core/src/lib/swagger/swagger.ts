import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BEARER_AUTH_SCHEME } from './constants';
import { SwaggerOptions } from './types/swagger.types';

export class Swagger {
    static setup(app: INestApplication, options: SwaggerOptions) {
        const config = new DocumentBuilder()
            .setTitle(options.title)
            .setDescription(options.description)
            .setVersion(options.version)
            .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Session bearer token issued by BetterAuth' }, BEARER_AUTH_SCHEME)
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup(options.path, app, document, { useGlobalPrefix: true });
    }
}
