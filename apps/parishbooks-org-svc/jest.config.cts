/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'parishbooks-org-svc',
    preset: '../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    },
    // Several @nestjs/* and auth deps ship ESM-only builds (no CJS), which
    // Jest's default node_modules-ignoring transform can't require(). Let
    // SWC transform them too rather than maintaining a package allowlist.
    transformIgnorePatterns: [],
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
};
