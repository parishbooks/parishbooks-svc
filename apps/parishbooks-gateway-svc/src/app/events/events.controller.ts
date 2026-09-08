import { Controller } from '@nestjs/common';
import { BaseController } from '../../libs/controller/base.controller';

@Controller('events')
export class EventsController extends BaseController {}
