import { Pool } from 'pg';

export const buildConnectionPool = (databaseURL: string) => {
    const options = `options=-c search_path=auth`;
    return new Pool({ connectionString: `${databaseURL}?${options}` });
};
