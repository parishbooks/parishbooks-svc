import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

// Used by the TypeORM CLI only (migration:generate / migration:run — see
// docs/specs/typeorm-database-schema.md §3). DatabaseModule is what
// services import at runtime.
export default new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [join(__dirname, 'lib', 'entities', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'lib', 'migration', '*.{ts,js}')],
    synchronize: false,
});
