import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthContext, HttpClientService } from '@parishbooks/core';
import { BaseController } from '../../libs/controller/base.controller';

@Controller('crm')
export class CrmController extends BaseController {
    protected readonly envKey = 'CRM_SERVICE_URL';

    constructor(httpClient: HttpClientService, configService: ConfigService, authContext: AuthContext) {
        super(httpClient, configService, authContext);
    }
}
