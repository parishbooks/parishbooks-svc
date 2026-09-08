import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface ProxyModuleOptions {
    /** Downstream service's base URL. */
    url: string;
}

/**
 * Shared ConfigurableModuleBuilder for every per-service proxy module
 * (AuthModule, OrgModule, ...). Each module extends `ProxyConfigurableModule`
 * to get `forRoot`/`forRootAsync`, and BaseController injects
 * `PROXY_MODULE_OPTIONS` to read the url it was configured with. Reusing
 * one builder is safe because each dynamic module registers its own
 * provider for the token, scoped to that module's own controller.
 */
export const { ConfigurableModuleClass: ProxyConfigurableModule, MODULE_OPTIONS_TOKEN: PROXY_MODULE_OPTIONS } =
    new ConfigurableModuleBuilder<ProxyModuleOptions>().setClassMethodName('forRoot').build();
