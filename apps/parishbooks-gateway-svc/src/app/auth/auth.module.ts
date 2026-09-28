import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLogger, AuthContext, AuthProxySessionHeaderMiddleware } from '@parishbooks/core';
import { proxyMiddleware } from '../../libs/middleware/service-proxy.middleware';
import { PROXY_MODULE_OPTIONS, ConfigurableProxyModule, ProxyModuleOptions } from '../../libs/module/proxy-module.builder';

@Module({})
export class AuthModule extends ConfigurableProxyModule implements NestModule {
    constructor(
        @Inject(PROXY_MODULE_OPTIONS) private readonly options: ProxyModuleOptions,
        private readonly authContext: AuthContext,
        private readonly logger: AppLogger,
    ) {
        super();
    }

    configure(consumer: MiddlewareConsumer): void {
        const options = { target: this.options.url, forwardSessionToken: true };
        consumer.apply(AuthProxySessionHeaderMiddleware, proxyMiddleware(this.authContext, this.logger, options)).forRoutes('auth');
    }
}
