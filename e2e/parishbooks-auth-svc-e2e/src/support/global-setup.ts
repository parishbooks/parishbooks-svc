import { waitForPortOpen } from '@nx/node/utils';
import { e2eConfig } from './e2e-config';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
    console.log('\nSetting up parishbooks-auth-svc e2e...\n');

    console.log(`Waiting for auth service at ${e2eConfig.host}:${e2eConfig.authPort}...`);
    await waitForPortOpen(e2eConfig.authPort, { host: e2eConfig.host });
    console.log(`Waiting for org service at ${e2eConfig.host}:${e2eConfig.orgPort}...`);
    await waitForPortOpen(e2eConfig.orgPort, { host: e2eConfig.host });

    globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down parishbooks-auth-svc e2e...\n';
};
