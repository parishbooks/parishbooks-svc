import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLogger, AuthContext } from '@parishbooks/core';
import { createServiceProxyMiddleware } from '../../libs/middleware/service-proxy.middleware';
import { PROXY_MODULE_OPTIONS, ProxyConfigurableModule, ProxyModuleOptions } from '../../libs/module/proxy-module.builder';

/**
 * No AuthMiddleware here (unlike every other per-service module) — auth-svc
 * hosts the login/signup/session flows a caller uses before they have a
 * session, so this prefix must stay reachable without a Bearer token, same
 * as the old `@Public()` AuthController.
 */
@Module({})
export class AuthModule extends ProxyConfigurableModule implements NestModule {
    constructor(
        @Inject(PROXY_MODULE_OPTIONS) private readonly options: ProxyModuleOptions,
        private readonly authContext: AuthContext,
        private readonly logger: AppLogger,
    ) {
        super();
    }

    configure(consumer: MiddlewareConsumer): void {
        const options = { target: this.options.url };
        consumer.apply(createServiceProxyMiddleware(this.authContext, this.logger, options)).forRoutes('auth');
    }
}
