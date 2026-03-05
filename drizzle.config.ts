import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Drizzle Kit');
}

export default defineConfig({
  out: './drizzle',
  schema: './server/db/schemas',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
});
