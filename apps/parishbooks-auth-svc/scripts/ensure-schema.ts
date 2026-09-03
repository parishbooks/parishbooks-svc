import { Client } from 'pg';

// BetterAuth's Pool connection pins `search_path=auth` (see libs/auth.config.ts),
// so the schema must exist before `auth@latest migrate` can create tables in it.
async function ensureAuthSchema() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query('CREATE SCHEMA IF NOT EXISTS auth');
    } finally {
        await client.end();
    }
}

ensureAuthSchema()
    .then(() => console.log('auth schema ready'))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
