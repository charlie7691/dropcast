import { serve } from "@hono/node-server";
import app from "./handler.js";

const port = 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Dropcast API running on http://localhost:${port}`);
});
