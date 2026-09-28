import { killPort } from '@nx/node/utils';
import { e2eConfig } from './e2e-config';

/* eslint-disable */

module.exports = async function () {
    await killPort(e2eConfig.authPort);
    await killPort(e2eConfig.orgPort);
    console.log(globalThis.__TEARDOWN_MESSAGE__);
};
