import { AppLogger, AuthContext } from '@parishbooks/core';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import type { Request, RequestHandler, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import { createLoggerPlugin, stripUnforwardedRequestHeaders } from './service-proxy.utils';

const FORWARDED_RESPONSE_HEADERS = new Set(['content-type', 'content-length', 'set-cookie', 'set-auth-token']);

export interface ServiceProxyOptions {
    target: string;
}

export function proxyMiddleware(authContext: AuthContext, logger: AppLogger, { target }: ServiceProxyOptions): RequestHandler {
    return createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        plugins: [createLoggerPlugin(logger)],
        on: {
            proxyReq: (proxyReq, req) => {
                stripUnforwardedRequestHeaders(proxyReq);
                const tenantId = authContext.getSession()?.session.activeOrganizationId;
                if (tenantId) proxyReq.setHeader('x-tenant-id', tenantId);
                fixRequestBody(proxyReq, req);
            },
            proxyRes: (proxyRes: IncomingMessage) => {
                for (const name of Object.keys(proxyRes.headers)) {
                    if (!FORWARDED_RESPONSE_HEADERS.has(name.toLowerCase())) delete proxyRes.headers[name];
                }
            },
            error: (err, _req, res) => {
                if (!('writeHead' in res) || !('end' in res)) return;
                if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ statusCode: 502, message: `Bad gateway: ${err.message}` }));
            },
        },
    });
}
