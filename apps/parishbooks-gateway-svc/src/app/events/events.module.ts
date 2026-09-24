import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthContext, AuthMiddleware } from '@parishbooks/core';
import { createServiceProxyMiddleware } from '../../libs/middleware/service-proxy.middleware';
import { PROXY_MODULE_OPTIONS, ProxyConfigurableModule, ProxyModuleOptions } from '../../libs/module/proxy-module.builder';

@Module({})
export class EventsModule extends ProxyConfigurableModule implements NestModule {
    constructor(
        @Inject(PROXY_MODULE_OPTIONS) private readonly options: ProxyModuleOptions,
        private readonly authContext: AuthContext,
    ) {
        super();
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthMiddleware, createServiceProxyMiddleware(this.authContext, { target: this.options.url })).forRoutes('events');
    }
}
