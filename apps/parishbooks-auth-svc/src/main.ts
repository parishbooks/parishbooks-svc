import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Swagger } from '@parishbooks/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const globalPrefix = 'api';

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix(globalPrefix);

    const port = process.env.PORT || 3000;

    Swagger.setup(app, { title: 'ParishBooks Auth Service', description: 'ParishBooks Auth Service', version: '1.0.0', path: globalPrefix });

    await app.listen(port, () => {
        Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    });
}

bootstrap();
