import { Controller } from '@nestjs/common';
import { Public } from '@parishbooks/core';
import { BaseController } from '../../libs/controller/base.controller';

@Public()
@Controller('auth')
export class AuthController extends BaseController {}
