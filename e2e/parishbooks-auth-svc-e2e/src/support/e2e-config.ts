import './load-e2e-env';

const required = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing ${key} in .env.e2e`);
    return value;
};

export const e2eConfig = {
    host: process.env.HOST ?? 'localhost',
    authPort: Number(process.env.AUTH_SERVICE_PORT ?? '8011'),
    orgPort: Number(process.env.ORG_SERVICE_PORT ?? '8017'),
    baseUrl: `http://${process.env.HOST ?? 'localhost'}:${process.env.AUTH_SERVICE_PORT ?? '8011'}/api`,
    internalServiceKey: required('INTERNAL_SERVICE_KEY'),
    databaseUrl: required('DATABASE_URL'),
    testPassword: process.env.E2E_TEST_PASSWORD ?? 'password123',
    skipMigrate: process.env.SKIP_E2E_MIGRATE === '1',
};
