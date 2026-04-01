import { Hono } from "hono";
import { jwtAuth } from "../middleware/jwt.js";
import { getConfig, saveConfig } from "../services/auth.js";
import { getProvider } from "../services/provider.js";

const onedrive = new Hono();

onedrive.get("/authorize", jwtAuth, async (c) => {
  const callbackUrl = `${process.env.BASE_URL || new URL("/", c.req.url).origin}/api/onedrive/callback`;
  try {
    const provider = await getProvider("onedrive");
    const url = await provider.getAuthorizeUrl(callbackUrl);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed" }, 400);
  }
});

onedrive.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing authorization code" }, 400);

  const callbackUrl = `${process.env.BASE_URL || new URL("/", c.req.url).origin}/api/onedrive/callback`;

  try {
    const provider = await getProvider("onedrive");
    const tokens = await provider.exchangeCode(code, callbackUrl);

    const config = await getConfig();
    if (!config) return c.json({ error: "App not configured" }, 500);

    config.onedrive = {
      ...config.onedrive,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiry: new Date(
        Date.now() + tokens.expiresIn * 1000
      ).toISOString(),
    };
    await saveConfig(config);

    const base = process.env.BASE_URL || new URL("/", c.req.url).origin;
    return c.redirect(`${base}/?onedrive=connected`);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

onedrive.get("/status", jwtAuth, async (c) => {
  const config = await getConfig();
  return c.json({
    connected: !!config?.onedrive?.refreshToken,
    hasCredentials: !!(process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET),
  });
});

onedrive.post("/disconnect", jwtAuth, async (c) => {
  const config = await getConfig();
  if (config) {
    delete config.onedrive;
    await saveConfig(config);
  }
  return c.json({ disconnected: true });
});

onedrive.get("/folders", jwtAuth, async (c) => {
  const path = c.req.query("path") || "";
  try {
    const provider = await getProvider("onedrive");
    const folders = await provider.listFolders(path);
    return c.json({ path, folders });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

export default onedrive;
