import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(__dirname, '../../..');
export const e2eEnvPath = resolve(workspaceRoot, '.env.e2e');

function parseEnvLine(line: string): { key: string; value: string } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const separator = trimmed.indexOf('=');
    if (separator === -1) return null;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return { key, value };
}

function loadEnvFile(path: string): void {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const parsed = parseEnvLine(line);
        if (parsed) process.env[parsed.key] = parsed.value;
    }
}

function readEnvValue(path: string, key: string): string | undefined {
    if (!existsSync(path)) return undefined;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const parsed = parseEnvLine(line);
        if (parsed?.key === key) return parsed.value;
    }
    return undefined;
}

function mergeDevDatabaseAndSecrets(): void {
    for (const file of ['.env', '.env.local']) {
        const path = resolve(workspaceRoot, file);
        const databaseUrl = readEnvValue(path, 'DATABASE_URL');
        if (databaseUrl) {
            process.env.DATABASE_URL = databaseUrl;
            console.warn(`[e2e] Using DATABASE_URL from ${file} to match nx serve.`);
        }
        if (databaseUrl) return;
    }
}

function isPortOpen(port: number): boolean {
    try {
        execSync(
            `node -e "require('net').connect(${port},'127.0.0.1').once('connect',()=>process.exit(0)).once('error',()=>process.exit(1))"`,
            { stdio: 'ignore', timeout: 500 },
        );
        return true;
    } catch {
        return false;
    }
}

function applyDevServiceFallback(): void {
    if (process.env.E2E_STRICT_PORTS === '1') return;

    const authPort = Number(process.env.AUTH_SERVICE_PORT ?? 8011);
    let usingDevServices = false;
    if (!isPortOpen(authPort) && isPortOpen(8001)) {
        process.env.AUTH_SERVICE_PORT = '8001';
        process.env.AUTH_SERVICE_URL = 'http://localhost:8001/api';
        process.env.BETTER_AUTH_URL = 'http://localhost:8001';
        console.warn(`[e2e] Auth not listening on :${authPort}; using nx serve default :8001.`);
        usingDevServices = true;
    }

    const orgPort = Number(process.env.ORG_SERVICE_PORT ?? 8017);
    if (!isPortOpen(orgPort) && isPortOpen(8007)) {
        process.env.ORG_SERVICE_PORT = '8007';
        process.env.ORG_SERVICE_URL = 'http://localhost:8007/api';
        console.warn(`[e2e] Org not listening on :${orgPort}; using nx serve default :8007.`);
        usingDevServices = true;
    }

    if (usingDevServices) {
        mergeDevDatabaseAndSecrets();
        const authOnDevPort = process.env.AUTH_SERVICE_PORT === '8001';
        if (authOnDevPort) mergeDevInternalServiceKey();
    }
}

function mergeDevInternalServiceKey(): void {
    for (const file of ['.env', '.env.local']) {
        const path = resolve(workspaceRoot, file);
        const internalKey = readEnvValue(path, 'INTERNAL_SERVICE_KEY');
        if (internalKey) {
            process.env.INTERNAL_SERVICE_KEY = internalKey;
            console.warn(`[e2e] Using INTERNAL_SERVICE_KEY from ${file} to match nx serve.`);
            return;
        }
    }
}

if (!existsSync(e2eEnvPath)) throw new Error(`Missing ${e2eEnvPath}. Copy .env.e2e.example to .env.e2e and adjust values.`);

loadEnvFile(e2eEnvPath);
applyDevServiceFallback();
