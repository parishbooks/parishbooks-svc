import { e2eConfig } from '../e2e-config';
import { createGlobalSetup } from './create-global-setup';

module.exports = createGlobalSetup({
    ports: [e2eConfig.authPort, e2eConfig.orgPort],
    host: e2eConfig.host,
    setupMessage: '\nparishbooks-auth-svc e2e: waiting for services (start with nx run *:serve-e2e)...\n',
    teardownMessage: '\nTearing down parishbooks-auth-svc e2e...\n',
});
