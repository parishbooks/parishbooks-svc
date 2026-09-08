import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthContext, HttpClientService, Public } from '@parishbooks/core';
import { BaseController } from '../../libs/controller/base.controller';

@Public()
@Controller('auth')
export class AuthController extends BaseController {
    protected readonly envKey = 'AUTH_SERVICE_URL';

    constructor(httpClient: HttpClientService, configService: ConfigService, authContext: AuthContext) {
        super(httpClient, configService, authContext);
    }
}
