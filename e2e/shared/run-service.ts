import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import './load-e2e-env';

const entry = process.argv[2];
if (!entry) throw new Error('Usage: bun e2e/shared/run-service.ts <path-to-main.js>');

const mainPath = resolve(process.cwd(), entry);
const child = spawn('node', [mainPath], { stdio: 'inherit', env: process.env, cwd: process.cwd() });
child.on('exit', (code) => process.exit(code ?? 0));
