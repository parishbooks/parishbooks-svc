import { waitForPortOpen } from '@nx/node/utils';
import { e2eConfig } from './e2e-config';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
    console.log('\nparishbooks-auth-svc e2e: waiting for services (start with nx run *:serve-e2e)...\n');

    await waitForPortOpen(e2eConfig.authPort, { host: e2eConfig.host });
    await waitForPortOpen(e2eConfig.orgPort, { host: e2eConfig.host });

    globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down parishbooks-auth-svc e2e...\n';
};
