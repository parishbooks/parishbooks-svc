import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiProperty, InternalServiceGuard, Public } from '@parishbooks/core';
import { SessionStatusResponseDto } from '../dto/response.dto';
import { SessionStatusService } from './session-status.service';

@ApiTags('identity')
@Controller('identity/session')
export class SessionStatusController {
    constructor(private readonly service: SessionStatusService) {}

    @ApiProperty({ name: 'getSessionStatus', status: HttpStatus.OK, responseType: SessionStatusResponseDto, internal: true })
    @ApiParam({ name: 'sessionId', description: 'BetterAuth session id' })
    @Public()
    @UseGuards(InternalServiceGuard)
    @Get(':sessionId/status')
    getStatus(@Param('sessionId') sessionId: string) {
        return this.service.getStatus(sessionId);
    }
}
