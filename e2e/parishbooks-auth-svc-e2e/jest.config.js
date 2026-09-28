/* eslint-disable */
const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'parishbooks-auth-svc-e2e',
    preset: '../../jest.preset.js',
    setupFiles: ['<rootDir>/src/support/test-setup.ts'],
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
    maxWorkers: 1,
};
