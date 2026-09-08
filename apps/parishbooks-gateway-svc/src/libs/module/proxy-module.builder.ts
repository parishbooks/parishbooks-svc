import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface ProxyModuleOptions {
    /** ConfigService key resolving to the downstream service's base URL. */
    envKey: string;
}

/**
 * Shared ConfigurableModuleBuilder for every per-service proxy module
 * (AuthModule, OrgModule, ...). Each module extends `ProxyConfigurableModule`
 * to get `forRoot`/`forRootAsync`, and BaseController injects
 * `PROXY_MODULE_OPTIONS` to read the envKey it was configured with. Reusing
 * one builder is safe because each dynamic module registers its own
 * provider for the token, scoped to that module's own controller.
 */
export const { ConfigurableModuleClass: ProxyConfigurableModule, MODULE_OPTIONS_TOKEN: PROXY_MODULE_OPTIONS } =
    new ConfigurableModuleBuilder<ProxyModuleOptions>().setClassMethodName('forRoot').build();
