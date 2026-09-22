import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { MemberController } from './member.controller';

@Module({
    controllers: [MemberController],
})
export class MemberModule extends ProxyConfigurableModule {}
