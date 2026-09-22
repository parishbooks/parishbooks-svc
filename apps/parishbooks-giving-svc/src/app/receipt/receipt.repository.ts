import { Injectable } from '@nestjs/common';
import { BaseRepository, Receipt } from '@parishbooks/database';
import { DataSource } from 'typeorm';

@Injectable()
export class ReceiptRepository extends BaseRepository<Receipt> {
    constructor(dataSource: DataSource) {
        super(Receipt, dataSource);
    }

    findByDonationId(organizationId: string, donationId: string): Promise<Receipt | null> {
        return this.findOneBy({ organizationId, donationId });
    }

    // Highest-numbered receipt issued so far for the FY, so ReceiptService
    // can derive the next sequential receiptNumber — the
    // (organizationId, financialYear, receiptNumber) unique constraint is
    // the DB-level backstop against a race producing a duplicate.
    findLatestForFinancialYear(organizationId: string, financialYear: string): Promise<Receipt | null> {
        return this.findOne({
            where: { organizationId, financialYear },
            order: { receiptNumber: 'DESC' },
        });
    }

    createReceipt(data: Partial<Receipt>): Promise<Receipt> {
        return this.save(this.create(data));
    }
}
