import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SwaggerOptions } from '../types/swagger.types.js';

export class Swagger {
    static setup(app: INestApplication, options: SwaggerOptions) {
        const config = new DocumentBuilder().setTitle(options.title).setDescription(options.description).setVersion(options.version).build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup(options.path, app, document);
    }
}
