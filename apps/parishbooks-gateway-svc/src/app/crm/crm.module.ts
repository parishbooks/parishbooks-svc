import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { CrmController } from './crm.controller';

@Module({
    controllers: [CrmController],
})
export class CrmModule extends ProxyConfigurableModule {}
