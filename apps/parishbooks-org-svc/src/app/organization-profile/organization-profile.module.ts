import { Module } from '@nestjs/common';
import { OrganizationProfileController } from './organization-profile.controller';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { OrganizationProfileService } from './organization-profile.service';

@Module({
    controllers: [OrganizationProfileController],
    providers: [OrganizationProfileService, OrganizationProfileRepository],
})
export class OrganizationProfileModule {}
