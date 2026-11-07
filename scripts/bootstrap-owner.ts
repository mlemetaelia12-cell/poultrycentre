import "dotenv/config";
import postgres from "postgres";
import argon2 from "argon2";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function askHidden(prompt: string): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run the owner bootstrap from an interactive terminal so the password can be hidden.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    let handler: (chunk: Buffer | string) => void;
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    const restore = () => {
      input.off("data", handler);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
    };
    handler = (chunk) => {
      const chars = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const char of chars) {
        if (char === "\u0003") {
          restore();
          reject(new Error("Owner setup cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          restore();
          resolve(value);
          return;
        }
        if (char === "\u0008" || char === "\u007f") {
          if (value.length) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          output.write("*");
        }
      }
    };
    input.on("data", handler);
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing. Configure .env first.");
  const sql = postgres(url, { max: 1, prepare: false, ssl: url.includes("localhost") ? false : "require" });
  const rl = createInterface({ input, output });
  try {
    const existing = await sql`SELECT id FROM users WHERE role = 'owner' LIMIT 1`;
    if (existing.length) throw new Error("An owner account already exists. This command cannot create another owner.");
    const username = (await rl.question("Owner username (3-40 characters): ")).trim().toLowerCase();
    const displayName = (await rl.question("Owner display name: ")).trim();
    rl.close();
    const password = await askHidden("Owner password (minimum 12 characters): ");
    const confirmation = await askHidden("Confirm password: ");
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new Error("Username must be 3-40 characters and use letters, numbers, dot, dash or underscore.");
    if (displayName.length < 2 || displayName.length > 120) throw new Error("Display name must be 2-120 characters.");
    if (password.length < 12 || password.length > 200) throw new Error("Password must be 12-200 characters.");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await sql`INSERT INTO users (username, password_hash, display_name, role) VALUES (${username}, ${passwordHash}, ${displayName}, 'owner')`;
    console.log("\nOwner account created successfully.");
    console.log("Keep the username and password private. No default credentials were created.");
  } finally {
    rl.close();
    await sql.end();
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
