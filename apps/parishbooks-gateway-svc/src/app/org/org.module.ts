import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { OrgController } from './org.controller';

@Module({
    controllers: [OrgController],
})
export class OrgModule extends ProxyConfigurableModule {}
