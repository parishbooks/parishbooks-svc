import { AuthContext } from '@parishbooks/core';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import type { Request, RequestHandler, Response } from 'express';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { loggerPlugin } from './service-proxy.utils';

/** Incoming request headers forwarded to the downstream service; not a blanket header passthrough. */
const FORWARDED_REQUEST_HEADERS = new Set(['authorization', 'cookie']);

/** Headers the proxied connection/body needs to work correctly; left untouched by the forwarding allowlist above. */
const PRESERVED_MECHANICAL_REQUEST_HEADERS = new Set(['host', 'connection', 'content-type', 'content-length']);

/** Downstream response headers proxied back to the caller; not a blanket header passthrough. */
const FORWARDED_RESPONSE_HEADERS = new Set(['content-type', 'content-length', 'set-cookie', 'set-auth-token']);

export interface ServiceProxyOptions {
    /** Downstream service's base URL. */
    target: string;
}

/**
 * Thin reverse proxy for one downstream service: forwards every request
 * received at the module's mount point (see each per-service module's
 * `configure()`) to `target`, propagating the caller's Bearer token and
 * resolved tenant id (CLAUDE.md rule 4). Carries no business logic — that
 * lives in the owning service, per docs/architecture/microservices-http.md.
 *
 * Mount this after AuthMiddleware (or standalone for a public prefix like
 * `/auth`) in the same `consumer.apply(...)` chain, at the service's own
 * prefix (e.g. `forRoutes('org')`) rather than a wildcard — Nest/Express
 * strips that mount path from `req.url` before this middleware runs, so the
 * remaining path is forwarded to `target` as-is, with no `pathRewrite`
 * needed.
 */
export function createServiceProxyMiddleware(authContext: AuthContext, { target }: ServiceProxyOptions): RequestHandler {
    return createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        plugins: [loggerPlugin],
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

function stripUnforwardedRequestHeaders(proxyReq: ClientRequest): void {
    for (const name of proxyReq.getHeaderNames()) {
        if (!FORWARDED_REQUEST_HEADERS.has(name) && !PRESERVED_MECHANICAL_REQUEST_HEADERS.has(name)) proxyReq.removeHeader(name);
    }
}
