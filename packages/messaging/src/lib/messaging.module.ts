import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { EMAIL_MODULE_OPTIONS } from './email/email.constants';
import { EmailService } from './email/email.service';
import { MessagingModuleAsyncOptions, MessagingModuleOptions } from './messaging.types';

@Global()
@Module({})
export class MessagingModule {
    static forRoot(options: MessagingModuleOptions): DynamicModule {
        return {
            module: MessagingModule,
            providers: [{ provide: EMAIL_MODULE_OPTIONS, useValue: options.email }, EmailService],
            exports: [EmailService],
        };
    }

    static forRootAsync(options: MessagingModuleAsyncOptions): DynamicModule {
        const optionsProvider: Provider = {
            provide: EMAIL_MODULE_OPTIONS,
            useFactory: async (...args: unknown[]) => (await options.useFactory(...args)).email,
            inject: options.inject ?? [],
        };

        return {
            module: MessagingModule,
            imports: options.imports ?? [],
            providers: [optionsProvider, EmailService],
            exports: [EmailService],
        };
    }
}
