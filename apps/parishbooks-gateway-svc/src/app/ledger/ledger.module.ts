import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { LedgerController } from './ledger.controller';

@Module({
    controllers: [LedgerController],
})
export class LedgerModule extends ProxyConfigurableModule {}
