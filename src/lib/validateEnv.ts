import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "FATAL ERROR: Variáveis de ambiente inválidas:",
    parsed.error.format()
  );
  process.exit(1);
}

export const config = Object.freeze(parsed.data);

export function validateEnv(requiredVars: string[]) {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `FATAL ERROR: Variáveis de ambiente ausentes: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}
