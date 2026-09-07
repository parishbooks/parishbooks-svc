import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Swagger } from '../swagger/swagger';
import { ApplicationBootstrapOptions } from './types/application.types';

export class Application {
    static async bootstrap(options: ApplicationBootstrapOptions): Promise<INestApplication> {
        const { module, port, swagger, globalPrefix = 'api', bodyParser = true } = options;

        const app = await NestFactory.create(module, { bodyParser });

        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        app.setGlobalPrefix(globalPrefix);

        Swagger.setup(app, { path: 'docs', ...swagger });

        await app.listen(port, () => {
            Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
            Logger.log(`📚 Swagger docs available at: http://localhost:${port}/${globalPrefix}/${swagger.path ?? 'docs'}`);
        });

        return app;
    }
}
