import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLogger, AuthContext } from '@parishbooks/core';
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
        const options = { target: this.options.url };
        consumer.apply(proxyMiddleware(this.authContext, this.logger, options)).forRoutes('auth');
    }
}
