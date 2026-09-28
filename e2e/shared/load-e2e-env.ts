import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../..');
export const e2eEnvPath = resolve(workspaceRoot, '.env.e2e');

function loadEnvFile(path: string): void {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        process.env[key] = value;
    }
}

if (!existsSync(e2eEnvPath)) throw new Error(`Missing ${e2eEnvPath}. Copy .env.e2e.example to .env.e2e and adjust values.`);

loadEnvFile(e2eEnvPath);
