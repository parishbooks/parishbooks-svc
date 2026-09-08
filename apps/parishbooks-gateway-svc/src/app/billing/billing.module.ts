import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { BillingController } from './billing.controller';

@Module({
    controllers: [BillingController],
})
export class BillingModule extends ProxyConfigurableModule {}
