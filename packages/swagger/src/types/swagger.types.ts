/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpStatus, Type } from '@nestjs/common';

export interface SwaggerOptions {
    title: string;
    description: string;
    version: string;
    path: string;
}

export interface ApiPropertyOptions {
    name: string;
    responseType: Type<any>;
    status?: HttpStatus;
    description?: string;
    example?: any;
    isArray?: boolean;
}
