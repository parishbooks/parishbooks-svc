import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { HttpClientService } from './http-client.service';
import { HttpClientModuleAsyncOptions, HttpClientModuleOptions } from './http-client.types';

const DEFAULT_OPTIONS: HttpClientModuleOptions = { timeout: 10_000, maxRedirects: 5 };

// HttpClientService injects TransactionContext from the logger module; the
// consuming app must also register LoggerModule.forRoot(Async)(...) so it's
// available globally.
@Module({})
export class HttpClientModule {
    static forRoot(options: HttpClientModuleOptions = {}): DynamicModule {
        return {
            module: HttpClientModule,
            imports: [HttpModule.register({ ...DEFAULT_OPTIONS, ...options })],
            providers: [HttpClientService],
            exports: [HttpClientService],
        };
    }

    static forRootAsync(options: HttpClientModuleAsyncOptions): DynamicModule {
        return {
            module: HttpClientModule,
            imports: [
                ...(options.imports ?? []),
                HttpModule.registerAsync({
                    inject: options.inject ?? [],
                    useFactory: async (...args: unknown[]) => ({ ...DEFAULT_OPTIONS, ...(await options.useFactory(...args)) }),
                }),
            ],
            providers: [HttpClientService],
            exports: [HttpClientService],
        };
    }
}
