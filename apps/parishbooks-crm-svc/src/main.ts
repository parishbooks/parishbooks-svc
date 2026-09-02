import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Swagger } from '@parishbooks/core';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const globalPrefix = 'api';

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix(globalPrefix);

    const port = process.env.PORT || 3000;

    Swagger.setup(app, { title: 'ParishBooks CRM Service', description: 'ParishBooks CRM Service', version: '1.0.0', path: 'docs' });

    await app.listen(port, () => {
        Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
        Logger.log(`📚 Swagger docs available at: http://localhost:${port}/${globalPrefix}/docs`);
    });
}

bootstrap();
