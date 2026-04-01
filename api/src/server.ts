import { serve } from "@hono/node-server";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./handler.js";
import { setStorage } from "./services/storage.js";
import { LocalStorage } from "./services/storage-local.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "..", "data");
setStorage(new LocalStorage(dataDir));

const port = 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Postcastify API running on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
});
