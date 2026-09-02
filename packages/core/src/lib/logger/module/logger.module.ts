import { DynamicModule, Global, MiddlewareConsumer, Module, NestModule, Provider } from '@nestjs/common';
import { LOGGER_MODULE_OPTIONS } from '../constants';
import { TransactionContext } from '../context/transaction-context';
import { AppLogger } from '../service/app-logger.service';
import { LoggerModuleAsyncOptions, LoggerModuleOptions } from '../types/logger.types';
import { LoggerMiddleware } from '../middleware/logger.middleware';

@Global()
@Module({})
export class LoggerModule implements NestModule {
    static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
        return {
            module: LoggerModule,
            providers: [{ provide: LOGGER_MODULE_OPTIONS, useValue: options }, TransactionContext, AppLogger, LoggerMiddleware],
            exports: [TransactionContext, AppLogger],
        };
    }

    static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
        const optionsProvider: Provider = {
            provide: LOGGER_MODULE_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject ?? [],
        };

        return {
            module: LoggerModule,
            imports: options.imports ?? [],
            providers: [optionsProvider, TransactionContext, AppLogger, LoggerMiddleware],
            exports: [TransactionContext, AppLogger],
        };
    }

    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('{*path}');
    }
}
