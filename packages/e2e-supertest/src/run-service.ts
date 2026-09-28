import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import './env';

const entry = process.argv[2];
if (!entry) throw new Error('Usage: bun packages/e2e-supertest/src/run-service.ts <path-to-main.js>');

const mainPath = resolve(process.cwd(), entry);
const child = spawn('node', [mainPath], { stdio: 'inherit', env: process.env, cwd: process.cwd() });
child.on('exit', (code) => process.exit(code ?? 0));
