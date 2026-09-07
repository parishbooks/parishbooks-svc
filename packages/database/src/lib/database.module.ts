import { join } from 'path';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseModuleAsyncOptions, DatabaseModuleOptions } from './database.types';
import { OrganizationProfile } from './entities/organization-profile.entity';

// Every entity in the platform lives under this package (one Postgres
// schema for the whole platform — docs/specs/typeorm-database-schema.md §3),
// so the list is fixed here rather than passed in by each service.
//
// Listed explicitly rather than glob-discovered (`entities/*.entity.{ts,js}`):
// consuming services bundle this package into a single webpack output, so
// there's no `entities/` directory of loose files on disk at runtime for a
// glob to find — TypeORM would report `EntityMetadataNotFoundError` for
// every entity despite the classes being present in the bundle.
const ENTITIES = [OrganizationProfile];
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
