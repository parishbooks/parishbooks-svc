/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseHook, BeforeCreate, AfterCreate } from '@thallesp/nestjs-better-auth';

@Injectable()
@DatabaseHook()
export class UserCreateHook {
    private readonly logger = new Logger(UserCreateHook.name);

    @BeforeCreate('user')
    async beforeCreate(user: any) {
        this.logger.log(`Before creating user: ${JSON.stringify(user)}`);
        // Perform any necessary operations before creating the user
    }

    @AfterCreate('user')
    async afterCreate(user: any) {
        this.logger.log(`After creating user: ${JSON.stringify(user)}`);
        // Perform any necessary operations after creating the user
    }
}
