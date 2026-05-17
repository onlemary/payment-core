import { defineConfig, coverageConfigDefaults } from 'vitest/config'
import { resolve } from 'path'

const dist = resolve(__dirname, './dist')

export default defineConfig({
  resolve: {
    alias: [
      // Map imports from tests that reference ../../src/react to dist
      { 
        find: /^\.\.\/\.\.\/(?:src\/(react\/.+\.js)|(react\/.+\.js))$/,
        replacement: (id) => id.replace('../../src/', `${dist}/`) 
      },
      // Handle direct dist imports from tests/react/parsers/ and tests/react/tokenizers/
      { find: '../../dist/', replacement: `${dist}/` },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    env: {
      PAYMENT_CORE_DB_URL: process.env.PAYMENT_CORE_DB_URL || process.env.DATABASE_URL || '',
      DATABASE_URL: process.env.DATABASE_URL || process.env.PAYMENT_CORE_DB_URL || '',
    },
    // Setup file for test cleanup and configuration
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Ignore unhandled errors from jsdom dependencies (non-critical)
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        // Barrel re-export files (no executable code)
        // NOTE: Do NOT use src/**/index.ts — it would exclude real provider implementations
        // (mercadopago/index.ts, stripe/index.ts, paypal/index.ts)
        'src/index.ts',
        'src/errors/index.ts',
        'src/logging/index.ts',
        'src/storage/index.ts',
        'src/universal/index.ts',
        'src/webhooks/index.ts',
        'src/routes/index.ts',
        'src/providers/index.ts',
        'src/providers/mercadopago/oauth/index.ts',
        'src/providers/mercadopago/payments/index.ts',
        'src/providers/mercadopago/sellers/index.ts',
        'src/providers/mercadopago/transfers/index.ts',
        'src/providers/mercadopago/webhooks/index.ts',
        // Type-only files
        'src/types.ts',
        'src/providers/types.ts',
        'src/providers/mercadopago/types.ts',
        'src/storage/types.ts',
        'src/universal/types.ts',
        // Test helpers and mocks
        'src/testing/**',
      ],
    },
  },
})
