import { ModuleMetadata, Type } from '@nestjs/common';

export interface SessionStatusModuleOptions {
    databaseUrl: string;
}

export interface SessionStatusModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: (Type<unknown> | string | symbol)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<SessionStatusModuleOptions> | SessionStatusModuleOptions;
}
