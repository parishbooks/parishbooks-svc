import { ConsoleLogger, Inject, Injectable, Scope } from '@nestjs/common';
import { LOGGER_MODULE_OPTIONS } from '../constants';
import { TransactionContext } from '../context/transaction-context';
import { LoggerModuleOptions } from '../types/logger.types';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
    constructor(
        private readonly transactionContext: TransactionContext,
        @Inject(LOGGER_MODULE_OPTIONS) private readonly loggerOptions: LoggerModuleOptions,
    ) {
        super();
    }

    private withTransactionId(message: unknown): unknown {
        const transactionId = this.transactionContext.getTransactionId();
        const prefixParts = [this.loggerOptions.serviceName, transactionId ? `txId:${transactionId}` : undefined].filter(Boolean);
        if (prefixParts.length === 0) return message;
        return `[${prefixParts.join('][')}] ${message}`;
    }

    override log(message: unknown, ...optionalParams: unknown[]) {
        super.log(this.withTransactionId(message), ...optionalParams);
    }

    override error(message: unknown, ...optionalParams: unknown[]) {
        super.error(this.withTransactionId(message), ...optionalParams);
    }

    override warn(message: unknown, ...optionalParams: unknown[]) {
        super.warn(this.withTransactionId(message), ...optionalParams);
    }

    override debug(message: unknown, ...optionalParams: unknown[]) {
        super.debug(this.withTransactionId(message), ...optionalParams);
    }

    override verbose(message: unknown, ...optionalParams: unknown[]) {
        super.verbose(this.withTransactionId(message), ...optionalParams);
    }
}
