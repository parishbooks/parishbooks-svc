import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthContext, HttpClientService } from '@parishbooks/core';
import { BaseController } from '../../libs/controller/base.controller';

@Controller('events')
export class EventsController extends BaseController {
    protected readonly envKey = 'EVENTS_SERVICE_URL';

    constructor(httpClient: HttpClientService, configService: ConfigService, authContext: AuthContext) {
        super(httpClient, configService, authContext);
    }
}
