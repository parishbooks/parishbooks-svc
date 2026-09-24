import { AppLogger } from '@parishbooks/core';
import { definePlugin, type Plugin } from 'http-proxy-middleware';
import type { Request, Response } from 'express';
import type { ClientRequest } from 'node:http';

/** Incoming request headers forwarded to the downstream service; not a blanket header passthrough. */
const FORWARDED_REQUEST_HEADERS = new Set(['authorization', 'cookie']);

/** Headers the proxied connection/body needs to work correctly; left untouched by the forwarding allowlist above. */
const PRESERVED_MECHANICAL_REQUEST_HEADERS = new Set(['host', 'connection', 'content-type', 'content-length']);

export function createLoggerPlugin(logger: AppLogger): Plugin<Request, Response> {
    return definePlugin<Request, Response>((proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
            logger.log(`Proxying request to: ${proxyReq.path}`);
        });
    });
}

export function stripUnforwardedRequestHeaders(proxyReq: ClientRequest): void {
    for (const name of proxyReq.getHeaderNames()) {
        if (!FORWARDED_REQUEST_HEADERS.has(name) && !PRESERVED_MECHANICAL_REQUEST_HEADERS.has(name)) proxyReq.removeHeader(name);
    }
}
