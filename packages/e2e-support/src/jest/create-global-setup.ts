import { waitForPortOpen } from '@nx/node/utils';

declare global {
    var __TEARDOWN_MESSAGE__: string | undefined;
}

export type GlobalSetupOptions = {
    ports: number[];
    host?: string;
    setupMessage?: string;
    teardownMessage?: string;
};

export function createGlobalSetup(options: GlobalSetupOptions): () => Promise<void> {
    const host = options.host ?? process.env.HOST ?? 'localhost';
    return async function globalSetup() {
        if (options.setupMessage) console.log(options.setupMessage);
        for (const port of options.ports) await waitForPortOpen(port, { host });
        globalThis.__TEARDOWN_MESSAGE__ = options.teardownMessage ?? '\nTearing down e2e...\n';
    };
}
