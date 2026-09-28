import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { TENANT_ID_HEADER } from '../../guard/auth/auth.constants';
import { BEARER_AUTH_SCHEME, INTERNAL_SERVICE_AUTH_SCHEME } from '../constants';
import { ApiPropertyOptions } from '../types/swagger.types';

export const ApiProperty = (options: ApiPropertyOptions) => {
    const useInternal = Boolean(options.internal);
    const useBearer = !options.public && !useInternal;

    return applyDecorators(
        ...(useBearer ? [ApiBearerAuth(BEARER_AUTH_SCHEME)] : []),
        ...(useInternal ? [ApiSecurity(INTERNAL_SERVICE_AUTH_SCHEME)] : []),
        ...(options.tenantHeader
            ? [ApiHeader({ name: TENANT_ID_HEADER, required: true, description: 'Active organization id; must match the path organizationId' })]
            : []),
        ApiOperation({ operationId: options.name, summary: options.description, description: options.description }),
        ApiResponse({ status: options.status || HttpStatus.OK, type: options.responseType, isArray: options.isArray }),
        ...(useBearer || useInternal ? [ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })] : []),
        ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' }),
        ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not found' }),
        ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error' }),
    );
};
