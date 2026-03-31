import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwtAuth } from "./middleware/jwt.js";
import authRoutes from "./routes/auth.js";
import dropboxRoutes from "./routes/dropbox.js";
import feedRoutes from "./routes/feeds.js";
import rssRoutes from "./routes/rss.js";
import logRoutes from "./routes/logs.js";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "dropcast" });
});

// Public auth routes (login is public, verify is protected inside)
app.route("/api/auth", authRoutes);

// Dropbox routes (callback is public, others protected inside)
app.route("/api/dropbox", dropboxRoutes);

// Protected routes (JWT enforced inside each)
app.route("/api/feeds", feedRoutes);
app.route("/api/logs", logRoutes);

// Public RSS feed endpoint
app.route("/rss", rssRoutes);

export default app;
