import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { OrganizationCountry, OrganizationCurrency, OrganizationPlanTier, OrganizationProfile } from './organization-profile.entity';

describe('OrganizationProfile (integration)', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [OrganizationProfile],
            synchronize: false,
        });
        await dataSource.initialize();
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    afterEach(async () => {
        await dataSource.query('TRUNCATE TABLE organization_profile');
    });

    it('creates a profile with defaults applied', async () => {
        const repository = dataSource.getRepository(OrganizationProfile);

        const saved = await repository.save(repository.create({ organizationId: randomUUID(), timezone: 'Asia/Kolkata' }));

        expect(saved.id).toBeDefined();
        expect(saved.country).toBe(OrganizationCountry.IN);
        expect(saved.planTier).toBe(OrganizationPlanTier.STARTER);
        expect(saved.currency).toBe(OrganizationCurrency.INR);
        expect(saved.fcraRegistered).toBe(false);
    });

    it('rejects a second profile for the same organizationId', async () => {
        const repository = dataSource.getRepository(OrganizationProfile);
        const organizationId = randomUUID();
        await repository.save(repository.create({ organizationId, timezone: 'Asia/Kolkata' }));

        await expect(repository.save(repository.create({ organizationId, timezone: 'Asia/Kolkata' }))).rejects.toThrow();
    });
});
