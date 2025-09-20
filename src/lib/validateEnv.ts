import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number(),
  MONGO_URI: z.string().url(),
  // Redis configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "FATAL ERROR: Invalid environment variables:",
    parsed.error.format()
  );
  process.exit(1);
}

export const config = Object.freeze(parsed.data);

export function validateEnv(requiredVars: string[]) {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `FATAL ERROR: Missing environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}
