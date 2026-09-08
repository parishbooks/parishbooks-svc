import { Module } from '@nestjs/common';
import { ProxyConfigurableModule } from '../../libs/module/proxy-module.builder';
import { EventsController } from './events.controller';

@Module({
    controllers: [EventsController],
})
export class EventsModule extends ProxyConfigurableModule {}
