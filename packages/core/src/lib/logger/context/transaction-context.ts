import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TRANSACTION_ID_HEADER } from '../constants';

interface TransactionStore {
    transactionId: string;
}

@Injectable()
export class TransactionContext {
    private readonly storage = new AsyncLocalStorage<TransactionStore>();

    run<T>(transactionId: string, callback: () => T): T {
        return this.storage.run({ transactionId }, callback);
    }

    getTransactionId(): string | undefined {
        return this.storage.getStore()?.transactionId;
    }

    /**
     * Headers to attach to any outbound request so a downstream service
     * continues the same trace instead of minting its own transaction id.
     */
    getPropagationHeaders(): Record<string, string> {
        const transactionId = this.getTransactionId();
        return transactionId ? { [TRANSACTION_ID_HEADER]: transactionId } : {};
    }
}
