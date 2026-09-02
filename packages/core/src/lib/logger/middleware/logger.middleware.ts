import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { TRANSACTION_ID_HEADER } from '../constants';
import { TransactionContext } from '../context/transaction-context';
import { AppLogger } from '../service/app-logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware<IncomingMessage, ServerResponse> {
    constructor(
        private readonly transactionContext: TransactionContext,
        private readonly logger: AppLogger,
    ) {
        this.logger.setContext('HTTP');
    }

    use(req: IncomingMessage, res: ServerResponse, next: () => void) {
        const incomingId = req.headers[TRANSACTION_ID_HEADER];
        const transactionId = typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : randomUUID();
        res.setHeader(TRANSACTION_ID_HEADER, transactionId);

        this.transactionContext.run(transactionId, () => {
            const startedAt = Date.now();
            this.logger.log(`--> ${req.method} ${req.url}`);

            res.on('finish', () => {
                const durationMs = Date.now() - startedAt;
                this.logger.log(`<-- ${req.method} ${req.url} ${res.statusCode} ${durationMs}ms`);
            });

            next();
        });
    }
}
