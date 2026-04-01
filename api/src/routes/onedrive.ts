import { Hono } from "hono";
import { jwtAuth } from "../middleware/jwt.js";
import { getConfig, saveConfig } from "../services/auth.js";
import { getProvider } from "../services/provider.js";

const onedrive = new Hono();

onedrive.get("/authorize", jwtAuth, async (c) => {
  const callbackUrl = new URL("/api/onedrive/callback", c.req.url).toString();
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

  const callbackUrl = new URL("/api/onedrive/callback", c.req.url).toString();

  try {
    const provider = await getProvider("onedrive");
    const tokens = await provider.exchangeCode(code, callbackUrl);

    const config = await getConfig();
    if (!config?.onedrive) return c.json({ error: "OneDrive not configured" }, 500);

    config.onedrive.refreshToken = tokens.refreshToken;
    config.onedrive.accessToken = tokens.accessToken;
    config.onedrive.accessTokenExpiry = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();
    await saveConfig(config);

    return c.redirect("/?onedrive=connected");
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

onedrive.get("/status", jwtAuth, async (c) => {
  const config = await getConfig();
  return c.json({
    connected: !!config?.onedrive?.refreshToken,
    hasCredentials: !!config?.onedrive?.clientId,
  });
});

onedrive.post("/disconnect", jwtAuth, async (c) => {
  const config = await getConfig();
  if (config?.onedrive) {
    delete config.onedrive.refreshToken;
    delete config.onedrive.accessToken;
    delete config.onedrive.accessTokenExpiry;
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
