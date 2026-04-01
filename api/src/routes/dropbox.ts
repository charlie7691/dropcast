import { Hono } from "hono";
import { jwtAuth } from "../middleware/jwt.js";
import { getConfig, saveConfig } from "../services/auth.js";
import { getProvider } from "../services/provider.js";

const dropbox = new Hono();

dropbox.get("/authorize", jwtAuth, async (c) => {
  const callbackUrl = new URL("/api/dropbox/callback", c.req.url).toString();
  try {
    const provider = await getProvider("dropbox");
    const url = await provider.getAuthorizeUrl(callbackUrl);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed" }, 400);
  }
});

dropbox.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing authorization code" }, 400);

  const callbackUrl = new URL("/api/dropbox/callback", c.req.url).toString();

  try {
    const provider = await getProvider("dropbox");
    const tokens = await provider.exchangeCode(code, callbackUrl);

    const config = await getConfig();
    if (!config) return c.json({ error: "App not configured" }, 500);

    config.dropbox = {
      ...config.dropbox,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiry: new Date(
        Date.now() + tokens.expiresIn * 1000
      ).toISOString(),
    };
    await saveConfig(config);

    return c.redirect("/?dropbox=connected");
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

dropbox.get("/status", jwtAuth, async (c) => {
  const config = await getConfig();
  return c.json({
    connected: !!config?.dropbox?.refreshToken,
    hasCredentials: !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET),
  });
});

dropbox.post("/disconnect", jwtAuth, async (c) => {
  const config = await getConfig();
  if (config) {
    delete config.dropbox;
    await saveConfig(config);
  }
  return c.json({ disconnected: true });
});

dropbox.get("/folders", jwtAuth, async (c) => {
  const path = c.req.query("path") || "";
  try {
    const provider = await getProvider("dropbox");
    const folders = await provider.listFolders(path);
    return c.json({ path, folders });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

export default dropbox;
