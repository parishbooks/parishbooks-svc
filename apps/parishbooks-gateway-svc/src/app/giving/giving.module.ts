import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { GivingController } from './giving.controller';

@Module({
    controllers: [GivingController],
})
export class GivingModule extends ProxyConfigurableModule {}
