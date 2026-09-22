import { OrganizationProfileRepository } from './organization-profile.repository';

describe('OrganizationProfileRepository.findByCashfreeVendorId', () => {
    it('looks up a profile by its cashfreeVendorId', async () => {
        const repository = Object.create(OrganizationProfileRepository.prototype) as OrganizationProfileRepository;
        const profile = { id: 'profile-1', cashfreeVendorId: 'vendor-123' };
        const findOneBy = jest.fn().mockResolvedValue(profile);
        Object.assign(repository, { findOneBy });

        const result = await repository.findByCashfreeVendorId('vendor-123');

        expect(findOneBy).toHaveBeenCalledWith({ cashfreeVendorId: 'vendor-123' });
        expect(result).toEqual(profile);
    });
});
