import { defineConfig, env } from 'prisma/config'

const dbUrl = process.env.PAYMENT_CORE_DB_URL

export default defineConfig({
  schema: './prisma/schema.prisma',
  ...(dbUrl
    ? {
        datasource: {
          url: env('PAYMENT_CORE_DB_URL'),
        },
      }
    : {}),
})
