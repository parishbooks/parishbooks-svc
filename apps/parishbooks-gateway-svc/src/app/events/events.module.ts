import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLogger, AuthContext, AuthMiddleware } from '@parishbooks/core';
import { proxyMiddleware } from '../../libs/middleware/service-proxy.middleware';
import { PROXY_MODULE_OPTIONS, ConfigurableProxyModule, ProxyModuleOptions } from '../../libs/module/proxy-module.builder';

@Module({})
export class EventsModule extends ConfigurableProxyModule implements NestModule {
    constructor(
        @Inject(PROXY_MODULE_OPTIONS) private readonly options: ProxyModuleOptions,
        private readonly authContext: AuthContext,
        private readonly logger: AppLogger,
    ) {
        super();
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthMiddleware, proxyMiddleware(this.authContext, this.logger, { target: this.options.url })).forRoutes('events');
    }
}
