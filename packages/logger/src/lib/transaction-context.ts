import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

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
}
