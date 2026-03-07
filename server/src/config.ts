import "dotenv/config";

type Config = {
  openaiApiKey: string;
  allowedOrigins: string | string[];
  openaiTranscribeModel: string;
  port: number;
  appPassword?: string;
  jwtSecret: string;
}

export const config: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) ?? [],
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  port: Number(process.env.PORT ?? 8000),
  appPassword: process.env.APP_PASSWORD,
  jwtSecret: process.env.JWT_SECRET ?? "change-me-please",
};

if (!config.openaiApiKey) {
  console.error("FATAL: OPENAI_API_KEY is not set.");
  process.exit(1);
}

if (!config.appPassword) {
  console.error("FATAL: APP_PASSWORD is not set in environment.");
  process.exit(1);
}

if (!config.jwtSecret || config.jwtSecret === "change-me-please") {
  console.error("FATAL: JWT_SECRET must be set.");
  process.exit(1);
}
