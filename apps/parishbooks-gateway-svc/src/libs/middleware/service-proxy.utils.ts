import { Logger } from '@nestjs/common';
import { definePlugin, type Plugin } from 'http-proxy-middleware';
import type { Request, Response } from 'express';

export const loggerPlugin: Plugin<Request, Response> = definePlugin<Request, Response>((proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
        Logger.log(`Proxying request to: ${proxyReq.path}`);
    });
});
