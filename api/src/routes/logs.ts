import { Hono } from "hono";
import { jwtAuth } from "../middleware/jwt.js";
import { getLogs } from "../services/logger.js";

const logs = new Hono();

logs.use("*", jwtAuth);

logs.get("/", async (c) => {
  const entries = await getLogs();
  return c.json({ logs: entries });
});

export default logs;
