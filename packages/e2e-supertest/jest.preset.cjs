const { readFileSync } = require('node:fs');
const path = require('node:path');
const nxPreset = require('@nx/jest/preset').default;

/** @param {string} e2eProjectRoot absolute or relative path to the e2e project folder */
function createE2eJestConfig(e2eProjectRoot, displayName) {
    const swcJestConfig = JSON.parse(readFileSync(path.join(e2eProjectRoot, '.spec.swcrc'), 'utf-8'));
    swcJestConfig.swcrc = false;
    const workspaceRoot = path.join(e2eProjectRoot, '../..');

    return {
        ...nxPreset,
        displayName,
        rootDir: e2eProjectRoot,
        testEnvironment: 'node',
        testEnvironmentOptions: {
            customExportConditions: ['node', 'require', 'default', '@parishbooks/source'],
        },
        setupFiles: [path.join(workspaceRoot, 'packages/e2e-supertest/jest.setup.ts')],
        transform: {
            '^.+\\.(m|c)?[tj]s$': ['@swc/jest', swcJestConfig],
        },
        transformIgnorePatterns: [],
        moduleFileExtensions: ['ts', 'js', 'html'],
        moduleNameMapper: {
            '^@parishbooks/core$': path.join(workspaceRoot, 'packages/core/src/index.ts'),
            '^@parishbooks/database$': path.join(workspaceRoot, 'packages/database/src/index.ts'),
            '^@parishbooks/config$': path.join(workspaceRoot, 'packages/config/src/index.ts'),
            '^@parishbooks/messaging$': path.join(workspaceRoot, 'packages/messaging/src/index.ts'),
            '^@parishbooks/e2e-supertest$': path.join(workspaceRoot, 'packages/e2e-supertest/src/index.ts'),
            '^@parishbooks/e2e-supertest/env$': path.join(workspaceRoot, 'packages/e2e-supertest/src/env.ts'),
        },
        coverageDirectory: path.join(e2eProjectRoot, 'test-output/jest/coverage'),
    };
}

module.exports = { createE2eJestConfig };
