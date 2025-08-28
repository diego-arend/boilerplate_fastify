import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error(
      `FATAL ERROR: Variáveis de ambiente ausentes: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}
