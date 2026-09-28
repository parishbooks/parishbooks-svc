import { Logger } from '@nestjs/common';
import { Application } from '@parishbooks/core';
import { AppModule } from './app/app.module';

async function main() {
    const port = Number(process.env.AUTH_SERVICE_PORT || 8001);
    const app = await Application.create({
        module: AppModule,
        bodyParser: false,
        swagger: { title: 'ParishBooks Auth Service', description: 'ParishBooks Auth Service', version: '1.0.0' },
    });
    const backofficeOrigin = process.env.BACKOFFICE_ORIGIN ?? 'http://localhost:3000';
    app.enableCors({ origin: backofficeOrigin, credentials: true });
    await app.listen(port, () => {
        Logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
        Logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
    });
}

void main();
