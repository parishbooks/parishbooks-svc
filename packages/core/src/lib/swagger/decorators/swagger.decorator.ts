import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiPropertyOptions } from '../types/swagger.types';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export const ApiProperty = (options: ApiPropertyOptions) => {
    return applyDecorators(
        ApiOperation({ operationId: options.name, summary: options.description, description: options.description }),
        ApiResponse({ status: options.status || HttpStatus.OK, type: options.responseType, isArray: options.isArray }),
        ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' }),
        ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' }),
        ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not found' }),
        ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error' }),
    );
};
