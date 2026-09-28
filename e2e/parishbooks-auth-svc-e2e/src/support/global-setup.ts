import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { waitForPortOpen } from '@nx/node/utils';
import { e2eConfig } from './e2e-config';

async function resetAuthSchema(): Promise<void> {
    if (!e2eConfig.databaseUrl.includes('parishbooks_e2e')) throw new Error('Refusing to reset auth schema outside the parishbooks_e2e database');

    const client = new Client({ connectionString: e2eConfig.databaseUrl });
    await client.connect();
    try {
        await client.query('DROP SCHEMA IF EXISTS auth CASCADE');
        await client.query('CREATE SCHEMA auth');
    } finally {
        await client.end();
    }
}

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
    console.log('\nSetting up parishbooks-auth-svc e2e...\n');

    if (!e2eConfig.skipMigrate) {
        await resetAuthSchema();
        execSync('bun scripts/ensure-schema.ts', {
            cwd: 'apps/parishbooks-auth-svc',
            env: process.env,
            stdio: 'inherit',
        });
        execSync('bun x auth migrate --yes', {
            cwd: 'apps/parishbooks-auth-svc',
            env: process.env,
            stdio: 'inherit',
        });

        const patchClient = new Client({ connectionString: e2eConfig.databaseUrl });
        await patchClient.connect();
        try {
            // better-auth 1.7.x + database joins expects this column; CLI migrate may lag behind runtime.
            await patchClient.query('ALTER TABLE auth.account ADD COLUMN IF NOT EXISTS issuer text');
        } finally {
            await patchClient.end();
        }
    }

    await waitForPortOpen(e2eConfig.authPort, { host: e2eConfig.host });
    await waitForPortOpen(e2eConfig.orgPort, { host: e2eConfig.host });

    globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down parishbooks-auth-svc e2e...\n';
};
