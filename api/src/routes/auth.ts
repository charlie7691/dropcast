import { Hono } from "hono";
import { getConfig, verifyPassword, createToken } from "../services/auth.js";
import { jwtAuth } from "../middleware/jwt.js";

const auth = new Hono();

auth.post("/login", async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const config = await getConfig();

  if (!config) {
    return c.json({ error: "App not configured. Run: pnpm run setup" }, 500);
  }

  if (
    body.username !== config.username ||
    !(await verifyPassword(body.password, config.passwordHash))
  ) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await createToken(config.username, config.jwtSecret);
  return c.json({ token });
});

auth.get("/verify", jwtAuth, async (c) => {
  return c.json({ valid: true });
});

export default auth;
