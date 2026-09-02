import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BEARER_AUTH_SCHEME } from '../constants';
import { ApiPropertyOptions } from '../types/swagger.types';

export const ApiProperty = (options: ApiPropertyOptions) => {
    return applyDecorators(
        ...(options.public ? [] : [ApiBearerAuth(BEARER_AUTH_SCHEME)]),
        ApiOperation({ operationId: options.name, summary: options.description, description: options.description }),
        ApiResponse({ status: options.status || HttpStatus.OK, type: options.responseType, isArray: options.isArray }),
        ...(options.public ? [] : [ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })]),
        ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' }),
        ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not found' }),
        ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error' }),
    );
};
