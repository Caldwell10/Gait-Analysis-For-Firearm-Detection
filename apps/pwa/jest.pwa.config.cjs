const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to the Next.js app to load next.config.js and .env files
  dir: './apps/pwa',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/apps/pwa/src/setupTests.ts'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/apps/pwa/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'apps/pwa/src/**/*.{js,jsx,ts,tsx}',
    '!apps/pwa/src/**/*.d.ts',
  ],
}

// Exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)