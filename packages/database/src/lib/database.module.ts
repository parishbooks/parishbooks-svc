import { join } from 'path';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseModuleAsyncOptions, DatabaseModuleOptions } from './database.types';

// Every entity/migration in the platform lives under this package (one
// Postgres schema for the whole platform — docs/specs/typeorm-database-schema.md §3),
// so the paths are fixed here rather than passed in by each service.
const ENTITIES = [join(__dirname, 'entities', '*.entity.{ts,js}')];
const MIGRATIONS = [join(__dirname, 'migration', '*.{ts,js}')];

@Global()
@Module({})
export class DatabaseModule {
    static forRoot(options: DatabaseModuleOptions): DynamicModule {
        return {
            module: DatabaseModule,
            imports: [
                TypeOrmModule.forRoot({
                    ...options,
                    entities: ENTITIES,
                    migrations: MIGRATIONS,
                    synchronize: false,
                } as TypeOrmModuleOptions),
            ],
            exports: [TypeOrmModule],
        };
    }

    static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
        return {
            module: DatabaseModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    imports: options.imports ?? [],
                    inject: options.inject ?? [],
                    useFactory: async (...args: unknown[]) =>
                        ({
                            ...(await options.useFactory(...args)),
                            entities: ENTITIES,
                            migrations: MIGRATIONS,
                            synchronize: false,
                        }) as TypeOrmModuleOptions,
                }),
            ],
            exports: [TypeOrmModule],
        };
    }
}
