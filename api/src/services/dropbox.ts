import { getConfig, saveConfig } from "./auth.js";
import {
  type CloudProvider,
  type CloudFile,
  type TokenSet,
  isMediaFile,
  registerProvider,
} from "./provider.js";

const AUTH_BASE = "https://www.dropbox.com";
const API_BASE = "https://api.dropboxapi.com/2";

function getCredentials() {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) throw new Error("Dropbox credentials not configured (set DROPBOX_APP_KEY and DROPBOX_APP_SECRET)");
  return { appKey, appSecret };
}

class DropboxProvider implements CloudProvider {
  id = "dropbox" as const;

  async getAuthorizeUrl(redirectUri: string): Promise<string> {
    const { appKey } = getCredentials();
    const params = new URLSearchParams({
      client_id: appKey,
      redirect_uri: redirectUri,
      response_type: "code",
      token_access_type: "offline",
    });
    return `${AUTH_BASE}/oauth2/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const { appKey, appSecret } = getCredentials();

    const res = await fetch(`${API_BASE}/../oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appKey,
        client_secret: appSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async listFiles(folderPath: string): Promise<CloudFile[]> {
    return listFolder(folderPath);
  }

  async getDownloadLink(filePath: string): Promise<string> {
    return getOrCreateSharedLink(filePath);
  }

  async listFolders(path: string): Promise<Array<{ name: string; path: string }>> {
    return listDropboxFolders(path);
  }
}

registerProvider("dropbox", async () => new DropboxProvider());

// --- Internal implementation ---

async function getAccessToken(): Promise<string> {
  const { appKey, appSecret } = getCredentials();
  const config = await getConfig();

  if (!config?.dropbox?.refreshToken) {
    throw new Error("Dropbox not connected");
  }

  if (
    config.dropbox.accessToken &&
    config.dropbox.accessTokenExpiry &&
    new Date(config.dropbox.accessTokenExpiry) > new Date()
  ) {
    return config.dropbox.accessToken;
  }

  const res = await fetch(`${API_BASE}/../oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.dropbox.refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  if (!config.dropbox) config.dropbox = {};
  config.dropbox.accessToken = data.access_token;
  config.dropbox.accessTokenExpiry = expiry;
  await saveConfig(config);

  return data.access_token;
}

async function listFolder(folderPath: string): Promise<CloudFile[]> {
  const token = await getAccessToken();
  const files: CloudFile[] = [];

  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const url = cursor
      ? `${API_BASE}/files/list_folder/continue`
      : `${API_BASE}/files/list_folder`;

    const body = cursor
      ? { cursor }
      : { path: folderPath || "", recursive: false };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`List folder failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    for (const entry of data.entries) {
      if (entry[".tag"] === "file" && isMediaFile(entry.name)) {
        files.push({
          name: entry.name,
          path: entry.path_display || entry.path_lower,
          size: entry.size,
          modified: entry.server_modified,
        });
      }
    }

    hasMore = data.has_more;
    cursor = data.cursor;
  }

  return files;
}

async function getOrCreateSharedLink(filePath: string): Promise<string> {
  const token = await getAccessToken();

  const createRes = await fetch(
    `${API_BASE}/sharing/create_shared_link_with_settings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: filePath,
        settings: { requested_visibility: "public" },
      }),
    }
  );

  if (createRes.ok) {
    const data = await createRes.json();
    return toDirectDownload(data.url);
  }

  const errorData = await createRes.json();
  if (errorData?.error?.[".tag"] === "shared_link_already_exists") {
    return getExistingSharedLink(token, filePath);
  }

  throw new Error(`Failed to create shared link: ${JSON.stringify(errorData)}`);
}

async function getExistingSharedLink(
  token: string,
  filePath: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/sharing/list_shared_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: filePath, direct_only: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List shared links failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.links?.length > 0) {
    return toDirectDownload(data.links[0].url);
  }

  throw new Error(`No shared links found for ${filePath}`);
}

async function listDropboxFolders(
  path: string = ""
): Promise<Array<{ name: string; path: string }>> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/files/list_folder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: path || "", recursive: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List folders failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.entries
    .filter((e: { [".tag"]: string }) => e[".tag"] === "folder")
    .map((e: { name: string; path_display: string }) => ({
      name: e.name,
      path: e.path_display,
    }));
}

function toDirectDownload(url: string): string {
  return url.replace(/\?dl=0$/, "?dl=1").replace(/&dl=0$/, "&dl=1");
}
