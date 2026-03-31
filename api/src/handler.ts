import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwtAuth } from "./middleware/jwt.js";
import authRoutes from "./routes/auth.js";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "dropcast" });
});

// Public auth routes (login + protected verify)
app.route("/api/auth", authRoutes);

// All other /api/* routes require JWT
app.use("/api/*", jwtAuth);

export default app;
