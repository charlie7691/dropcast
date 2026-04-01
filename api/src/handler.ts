import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth.js";
import dropboxRoutes from "./routes/dropbox.js";
import onedriveRoutes from "./routes/onedrive.js";
import feedRoutes from "./routes/feeds.js";
import rssRoutes from "./routes/rss.js";
import logRoutes from "./routes/logs.js";

// Import providers to trigger registration
import "./services/dropbox.js";
import "./services/onedrive.js";

const app = new Hono();

app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "dropcast" });
});

app.route("/api/auth", authRoutes);
app.route("/api/dropbox", dropboxRoutes);
app.route("/api/onedrive", onedriveRoutes);
app.route("/api/feeds", feedRoutes);
app.route("/api/logs", logRoutes);
app.route("/rss", rssRoutes);

export default app;
