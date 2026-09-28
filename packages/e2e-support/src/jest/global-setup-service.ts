import { createGlobalSetup } from './create-global-setup';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

module.exports = createGlobalSetup({
    ports: [port],
    host,
    setupMessage: '\nSetting up...\n',
    teardownMessage: '\nTearing down...\n',
});
