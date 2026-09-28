/* eslint-disable */
const path = require('node:path');
const { createE2eJestConfig } = require('../../packages/e2e-supertest/jest.preset.cjs');

module.exports = {
    ...createE2eJestConfig(path.join(__dirname), 'parishbooks-events-svc-e2e'),
    setupFilesAfterEnv: ['<rootDir>/src/support/app.ts'],
};
