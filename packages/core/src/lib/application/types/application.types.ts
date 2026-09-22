import { Type } from '@nestjs/common';
import { SwaggerOptions } from '../../swagger/types/swagger.types';

export interface ApplicationBootstrapOptions {
    /** Root module of the service (usually AppModule). */
    module: Type<unknown>;
    /** Port to listen on, e.g. process.env.AUTH_SERVICE_PORT || 8001. */
    port: string | number;
    /** Swagger document options. `path` defaults to 'docs' when omitted. */
    swagger: Omit<SwaggerOptions, 'path'> & Partial<Pick<SwaggerOptions, 'path'>>;
    /** Global route prefix. Defaults to 'api'. */
    globalPrefix?: string;
    /** Passed through to NestFactory.create. Set false for services (e.g. auth) that need the raw request body. */
    bodyParser?: boolean;
    /** Populates `request.rawBody` for webhook signature verification. Default false. */
    rawBody?: boolean;
}
