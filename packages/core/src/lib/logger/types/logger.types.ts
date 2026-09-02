import { ModuleMetadata, Type } from '@nestjs/common';

export interface LoggerModuleOptions {
    /** Included in every log line so entries can be attributed to the emitting service. */
    serviceName?: string;
}

export interface LoggerModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: (Type<unknown> | string | symbol)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
}
