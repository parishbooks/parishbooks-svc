import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthContext } from '@parishbooks/core';
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
    ) {
        super();
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(createServiceProxyMiddleware(this.authContext, { target: this.options.url })).forRoutes('auth');
    }
}
