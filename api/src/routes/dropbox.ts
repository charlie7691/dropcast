import { Hono } from "hono";
import { jwtAuth } from "../middleware/jwt.js";
import {
  getConfig,
  saveConfig,
} from "../services/auth.js";
import {
  getAuthorizeUrl,
  exchangeCodeForTokens,
  listFolders,
} from "../services/dropbox.js";

const dropbox = new Hono();

// Start OAuth flow — returns the Dropbox authorization URL
dropbox.get("/authorize", jwtAuth, async (c) => {
  const config = await getConfig();
  if (!config?.dropbox?.appKey) {
    return c.json(
      { error: "Dropbox app credentials not configured. Run: pnpm run setup" },
      400
    );
  }

  const callbackUrl = new URL("/api/dropbox/callback", c.req.url).toString();
  const url = getAuthorizeUrl(config.dropbox.appKey, callbackUrl);
  return c.json({ url });
});

// OAuth callback — exchanges code for tokens
dropbox.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  const config = await getConfig();
  if (!config?.dropbox?.appKey || !config?.dropbox?.appSecret) {
    return c.json({ error: "Dropbox not configured" }, 500);
  }

  const callbackUrl = new URL("/api/dropbox/callback", c.req.url).toString();

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      config.dropbox.appKey,
      config.dropbox.appSecret,
      callbackUrl
    );

    config.dropbox.refreshToken = tokens.refreshToken;
    config.dropbox.accessToken = tokens.accessToken;
    config.dropbox.accessTokenExpiry = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    await saveConfig(config);

    // Redirect back to the web app
    return c.redirect("/?dropbox=connected");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: msg }, 500);
  }
});

// Check connection status
dropbox.get("/status", jwtAuth, async (c) => {
  const config = await getConfig();
  const connected = !!config?.dropbox?.refreshToken;
  return c.json({
    connected,
    hasCredentials: !!config?.dropbox?.appKey,
  });
});

// Disconnect Dropbox
dropbox.post("/disconnect", jwtAuth, async (c) => {
  const config = await getConfig();
  if (config?.dropbox) {
    delete config.dropbox.refreshToken;
    delete config.dropbox.accessToken;
    delete config.dropbox.accessTokenExpiry;
    await saveConfig(config);
  }
  return c.json({ disconnected: true });
});

// Browse folders
dropbox.get("/folders", jwtAuth, async (c) => {
  const path = c.req.query("path") || "";
  try {
    const folders = await listFolders(path);
    return c.json({ path, folders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: msg }, 500);
  }
});

export default dropbox;
