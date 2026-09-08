import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { AuthController } from './auth.controller';

@Module({
    controllers: [AuthController],
})
export class AuthModule extends ProxyConfigurableModule {}
