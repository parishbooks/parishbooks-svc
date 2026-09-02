import { ModuleMetadata, Type } from '@nestjs/common';
import type { HttpModuleOptions } from '@nestjs/axios';

export type HttpClientModuleOptions = HttpModuleOptions;

export interface HttpClientModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: (Type<unknown> | string | symbol)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<HttpClientModuleOptions> | HttpClientModuleOptions;
}
