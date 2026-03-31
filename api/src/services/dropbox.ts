import { getConfig, saveConfig, type AppConfig } from "./auth.js";

const AUTH_BASE = "https://www.dropbox.com";
const API_BASE = "https://api.dropboxapi.com/2";

export interface DropboxFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDownloadable: boolean;
}

export function getAuthorizeUrl(appKey: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
  });
  return `${AUTH_BASE}/oauth2/authorize?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  appKey: string,
  appSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
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

export async function refreshAccessToken(
  config: AppConfig
): Promise<string> {
  if (!config.dropbox?.refreshToken) {
    throw new Error("No refresh token available");
  }

  // Check if current token is still valid
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
      client_id: config.dropbox.appKey,
      client_secret: config.dropbox.appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  config.dropbox.accessToken = data.access_token;
  config.dropbox.accessTokenExpiry = expiry;
  await saveConfig(config);

  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const config = await getConfig();
  if (!config?.dropbox) throw new Error("Dropbox not connected");
  return refreshAccessToken(config);
}

export async function listFolder(
  folderPath: string
): Promise<DropboxFile[]> {
  const token = await getAccessToken();
  const files: DropboxFile[] = [];

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
          isDownloadable: entry.is_downloadable !== false,
        });
      }
    }

    hasMore = data.has_more;
    cursor = data.cursor;
  }

  return files;
}

export async function getOrCreateSharedLink(
  filePath: string
): Promise<string> {
  const token = await getAccessToken();

  // Try to create a new shared link
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

  // If link already exists, fetch it
  const errorData = await createRes.json();
  if (
    errorData?.error?.[".tag"] === "shared_link_already_exists"
  ) {
    return getExistingSharedLink(token, filePath);
  }

  throw new Error(
    `Failed to create shared link: ${JSON.stringify(errorData)}`
  );
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

export async function listFolders(
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
  // Replace dl=0 with dl=1 for direct download
  return url.replace(/\?dl=0$/, "?dl=1").replace(/&dl=0$/, "&dl=1");
}

const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".m4a", ".mp4", ".m4v", ".mov", ".wav", ".ogg", ".flac", ".aac",
]);

function isMediaFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/x-m4a",
    ".mp4": "video/mp4",
    ".m4v": "video/x-m4v",
    ".mov": "video/quicktime",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
  };
  return map[ext] || "application/octet-stream";
}
