import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route (or an entire controller) as not requiring AuthGuard's bearer-token check. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
