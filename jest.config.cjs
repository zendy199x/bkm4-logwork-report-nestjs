module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  collectCoverageFrom: ["src/**/*.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testRegex: String.raw`.*\.spec\.ts$`,
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    [String.raw`^.+\.(t|j)s$`]: [
      "ts-jest",
      {
        tsconfig: "tsconfig.spec.json",
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
