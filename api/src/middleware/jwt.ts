import { createMiddleware } from "hono/factory";
import { getConfig, verifyToken } from "../services/auth.js";

export const jwtAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = header.slice(7);
  const config = await getConfig();
  if (!config) {
    return c.json({ error: "App not configured" }, 500);
  }

  const payload = await verifyToken(token, config.jwtSecret);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("user", payload.sub);
  await next();
});
