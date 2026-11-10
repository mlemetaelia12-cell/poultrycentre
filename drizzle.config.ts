
const drizzleConfig = {
  schema: "./src/db/schema.ts",
  out: "./drizzle/generated",
  dialect: "postgresql" as const,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder",
  },
};

export default drizzleConfig;
