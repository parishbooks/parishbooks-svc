import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationPlanTier, OrganizationProfile } from '@parishbooks/database';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { SyncBillingDto } from './dto/sync-billing.dto';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
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

    async findByOrganizationId(organizationId: string): Promise<OrganizationProfile> {
        const profile = await this.repository.findByOrganizationId(organizationId);
        if (!profile) throw new NotFoundException(`Organization profile not found for organization ${organizationId}`);
        return profile;
    }

    async update(organizationId: string, dto: UpdateOrganizationProfileDto): Promise<OrganizationProfile> {
        const profile = await this.findByOrganizationId(organizationId);
        return this.repository.updateProfile(profile.id, dto);
    }

    async syncBilling(organizationId: string, dto: SyncBillingDto): Promise<OrganizationProfile> {
        const profile = await this.findByOrganizationId(organizationId);
        return this.repository.updateProfile(profile.id, dto);
    }
}
