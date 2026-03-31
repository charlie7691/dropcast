import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import app from "./handler.js";
import { setStorage } from "./services/storage.js";
import { LocalStorage } from "./services/storage-local.js";

const dataDir = resolve(process.cwd(), "..", "data");
setStorage(new LocalStorage(dataDir));

const port = 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Dropcast API running on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
});
