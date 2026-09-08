import { All, HttpException, Req, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthContext, HttpClientService } from '@parishbooks/core';
import { isAxiosError } from 'axios';
import type { Request } from 'express';

/**
 * Thin reverse proxy: forwards every request under a subclass's controller
 * prefix to the downstream service named by `envKey`, propagating the
 * caller's Bearer token and resolved tenant id (CLAUDE.md rule 4). Carries no
 * business logic — that lives in the owning service, per
 * docs/architecture/microservices-http.md.
 */
export abstract class BaseController {
    protected abstract readonly envKey: string;
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        protected readonly httpClient: HttpClientService,
        protected readonly configService: ConfigService,
        protected readonly authContext: AuthContext,
    ) {}

    @All('*path')
    async forward(@Req() req: Request): Promise<unknown> {
        const baseUrl = this.configService.getOrThrow<string>(this.envKey);
        const path = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;
        const targetUrl = `${baseUrl}/${path}${this.queryString(req)}`;

        const headers: Record<string, string> = {};
        if (req.headers.authorization) headers.authorization = req.headers.authorization;
        const tenantId = this.authContext.getSession()?.session.activeOrganizationId;
        if (tenantId) headers['x-tenant-id'] = tenantId;

        this.logger.log(`${req.method} ${req.originalUrl} -> ${targetUrl}`);

        try {
            return await this.dispatch(req.method, targetUrl, headers, req.body);
        } catch (error) {
            if (isAxiosError(error) && error.response) {
                this.logger.warn(`${req.method} ${targetUrl} failed with ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                throw new HttpException(error.response.data, error.response.status);
            }
            this.logger.error(`${req.method} ${targetUrl} failed: ${(error as Error).message}`, (error as Error).stack);
            throw error;
        }
    }

    private dispatch(method: string, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
        switch (method.toUpperCase()) {
            case 'GET':
                return this.httpClient.get(url, { headers });
            case 'POST':
                return this.httpClient.post(url, body, { headers });
            case 'PUT':
                return this.httpClient.put(url, body, { headers });
            case 'PATCH':
                return this.httpClient.patch(url, body, { headers });
            case 'DELETE':
                return this.httpClient.delete(url, { headers });
            default:
                throw new HttpException(`Unsupported method: ${method}`, 405);
        }
    }

    private queryString(req: Request): string {
        const index = req.originalUrl.indexOf('?');
        return index === -1 ? '' : req.originalUrl.slice(index);
    }
}
