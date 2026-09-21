import { ModuleMetadata, Type } from '@nestjs/common';
import { EmailModuleOptions } from './email/email.types';

export interface MessagingModuleOptions {
    email: EmailModuleOptions;
}

export interface MessagingModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: (Type<unknown> | string | symbol)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<MessagingModuleOptions> | MessagingModuleOptions;
}
