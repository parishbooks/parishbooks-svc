/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'core',
    preset: '../../jest.preset.js',
    testEnvironment: 'node',
    // Several @nestjs/* and auth deps ship ESM-only builds (no CJS) with
    // .mjs files, which Jest's default node_modules-ignoring transform (and
    // its default .ts/.js-only transform pattern) can't require(). Widen
    // both so SWC transforms them too, rather than maintaining a package
    // allowlist.
    transform: {
        '^.+\\.(m|c)?[tj]s$': ['@swc/jest', swcJestConfig],
    },
    transformIgnorePatterns: [],
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
};
