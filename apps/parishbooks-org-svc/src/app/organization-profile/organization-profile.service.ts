import { ConflictException, Injectable } from '@nestjs/common';
import { OrganizationPlanTier, OrganizationProfile } from '@parishbooks/database';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { OrganizationProfileRepository } from './organization-profile.repository';

@Injectable()
export class OrganizationProfileService {
    constructor(private readonly repository: OrganizationProfileRepository) {}

    async create(organizationId: string, dto: CreateOrganizationProfileDto): Promise<OrganizationProfile> {
        const existing = await this.repository.findByOrganizationId(organizationId);
        if (existing) throw new ConflictException(`Organization profile already exists for organization ${organizationId}`);
        return this.repository.createProfile({
            organizationId,
            timezone: dto.timezone,
            country: dto.country,
            currency: dto.currency,
            fcraRegistered: dto.fcraRegistered,
            registrationNumber: dto.registrationNumber,
            taxExemptionNumber80g: dto.taxExemptionNumber80g,
            planTier: OrganizationPlanTier.STARTER,
        });
    }
}
