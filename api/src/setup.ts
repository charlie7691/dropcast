import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { LocalStorage } from "./services/storage-local.js";
import { hashPassword, type AppConfig } from "./services/auth.js";
import { setStorage } from "./services/storage.js";

const rl = createInterface({ input: stdin, output: stdout });

async function prompt(question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function main() {
  console.log("\n  Postcastify Setup\n");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dataDir = resolve(__dirname, "..", "..", "data");
  const storage = new LocalStorage(dataDir);
  setStorage(storage);

  const existing = await storage.readJson<AppConfig>("config.json");
  if (existing) {
    const overwrite = await prompt("Config already exists. Overwrite? (y/N): ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted.");
      rl.close();
      return;
    }
  }

  const username = await prompt("Username: ");
  const password = await prompt("Password: ");

  if (!username || !password) {
    console.error("Username and password are required.");
    rl.close();
    return;
  }

  const config: AppConfig = {
    username,
    passwordHash: await hashPassword(password),
    jwtSecret: randomBytes(32).toString("hex"),
  };

  // Dropbox credentials
  const dropboxAppKey = await prompt(
    "Dropbox App Key (leave empty to skip): "
  );
  if (dropboxAppKey) {
    const dropboxAppSecret = await prompt("Dropbox App Secret: ");
    config.dropbox = { appKey: dropboxAppKey, appSecret: dropboxAppSecret };
  }

  // OneDrive credentials
  const onedriveClientId = await prompt(
    "OneDrive Client ID (leave empty to skip): "
  );
  if (onedriveClientId) {
    const onedriveClientSecret = await prompt("OneDrive Client Secret: ");
    config.onedrive = { clientId: onedriveClientId, clientSecret: onedriveClientSecret };
  }

  await storage.writeJson("config.json", config);
  console.log(`\nConfig saved to ${dataDir}/config.json`);
  console.log("Run 'pnpm dev' to start the server.\n");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
