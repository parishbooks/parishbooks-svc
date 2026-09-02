import { ModuleMetadata, Type } from '@nestjs/common';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

// entities/migrations/synchronize are fixed by DatabaseModule — see
// database.module.ts and CLAUDE.md rule 3 (synchronize must stay false).
export type DatabaseModuleOptions = Omit<TypeOrmModuleOptions, 'entities' | 'migrations' | 'synchronize'>;

export interface DatabaseModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: (Type<unknown> | string | symbol)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
}
