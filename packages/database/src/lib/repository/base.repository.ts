import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

export abstract class BaseRepository<Entity extends ObjectLiteral> extends Repository<Entity> {
    protected constructor(entityTarget: EntityTarget<Entity>, dataSource: DataSource) {
        super(entityTarget, dataSource.createEntityManager());
    }
}
