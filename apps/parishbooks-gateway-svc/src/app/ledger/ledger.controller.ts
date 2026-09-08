import { Controller } from '@nestjs/common';
import { BaseController } from '../../libs/controller/base.controller';

@Controller('ledger')
export class LedgerController extends BaseController {}
