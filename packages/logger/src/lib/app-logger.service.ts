import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { TransactionContext } from './transaction-context';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
    constructor(private readonly transactionContext: TransactionContext) {
        super();
    }

    private withTransactionId(message: unknown): unknown {
        const transactionId = this.transactionContext.getTransactionId();
        if (!transactionId) return message;
        return `[txId:${transactionId}] ${message}`;
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
