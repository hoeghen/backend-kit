/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    // Stub Firebase modules so tests don't need a live project
    "^firebase/(.*)$": "<rootDir>/tests/__mocks__/firebase.ts",
    // ts-jest: resolve ESM .js extensions back to .ts source files
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};
