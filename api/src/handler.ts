import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwtAuth } from "./middleware/jwt.js";
import authRoutes from "./routes/auth.js";
import dropboxRoutes from "./routes/dropbox.js";

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

// All other /api/* routes require JWT
app.use("/api/*", jwtAuth);

export default app;
