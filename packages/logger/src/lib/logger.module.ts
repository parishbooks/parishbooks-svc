import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppLogger } from './app-logger.service';
import { LoggerMiddleware } from './logger.middleware';
import { TransactionContext } from './transaction-context';

@Global()
@Module({
    providers: [TransactionContext, AppLogger, LoggerMiddleware],
    exports: [TransactionContext, AppLogger],
})
export class LoggerModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
