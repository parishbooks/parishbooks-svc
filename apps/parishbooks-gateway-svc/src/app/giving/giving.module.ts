import { Module } from '@nestjs/common';
import { GivingController } from './giving.controller';

@Module({
    controllers: [GivingController],
})
export class GivingModule {}
