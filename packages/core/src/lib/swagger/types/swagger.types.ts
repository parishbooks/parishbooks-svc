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
    /** Set true for routes that don't require authentication (e.g. sign-up/sign-in). Defaults to false. */
    public?: boolean;
}
