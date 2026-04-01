import { getConfig, saveConfig } from "./auth.js";
import {
  type CloudProvider,
  type CloudFile,
  type TokenSet,
  isMediaFile,
  registerProvider,
} from "./provider.js";

const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

class OneDriveProvider implements CloudProvider {
  id = "onedrive" as const;

  async getAuthorizeUrl(redirectUri: string): Promise<string> {
    const config = await getConfig();
    if (!config?.onedrive?.clientId) {
      throw new Error("OneDrive app credentials not configured");
    }
    const params = new URLSearchParams({
      client_id: config.onedrive.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "files.read offline_access",
    });
    return `${AUTH_BASE}/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const config = await getConfig();
    if (!config?.onedrive?.clientId || !config?.onedrive?.clientSecret) {
      throw new Error("OneDrive app credentials not configured");
    }

    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.onedrive.clientId,
        client_secret: config.onedrive.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive token exchange failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async listFiles(folderPath: string): Promise<CloudFile[]> {
    const token = await this.getAccessToken();
    const files: CloudFile[] = [];

    // Graph API path format: /me/drive/root:/path:/children
    const encodedPath = folderPath ? `/root:${folderPath}:` : "/root";
    let url: string | null =
      `${GRAPH_BASE}/me/drive${encodedPath}/children?$select=name,size,lastModifiedDateTime,id,file,folder`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OneDrive list files failed: ${res.status} ${text}`);
      }

      const data = await res.json();

      for (const item of data.value) {
        // Only include files (not folders) that are media
        if (item.file && isMediaFile(item.name)) {
          files.push({
            name: item.name,
            path: item.id, // OneDrive uses item ID for createLink
            id: item.id,
            size: item.size,
            modified: item.lastModifiedDateTime,
          });
        }
      }

      url = data["@odata.nextLink"] || null;
    }

    return files;
  }

  async getDownloadLink(itemId: string): Promise<string> {
    const token = await this.getAccessToken();

    // Try to create a sharing link
    const res = await fetch(
      `${GRAPH_BASE}/me/drive/items/${itemId}/createLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "view",
          scope: "anonymous",
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive createLink failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const webUrl: string = data.link?.webUrl;
    if (!webUrl) {
      throw new Error("OneDrive createLink returned no webUrl");
    }

    // Convert sharing URL to direct download URL
    return toDirectDownload(webUrl);
  }

  async listFolders(path: string): Promise<Array<{ name: string; path: string }>> {
    const token = await this.getAccessToken();

    const encodedPath = path ? `/root:${path}:` : "/root";
    const url = `${GRAPH_BASE}/me/drive${encodedPath}/children?$select=name,folder,id&$filter=folder ne null`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive list folders failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.value
      .filter((item: { folder?: unknown }) => item.folder)
      .map((item: { name: string; id: string }) => ({
        name: item.name,
        path: path ? `${path}/${item.name}` : `/${item.name}`,
      }));
  }

  private async getAccessToken(): Promise<string> {
    const config = await getConfig();
    if (!config?.onedrive?.refreshToken) {
      throw new Error("OneDrive not connected");
    }

    // Check if current token is still valid
    if (
      config.onedrive.accessToken &&
      config.onedrive.accessTokenExpiry &&
      new Date(config.onedrive.accessTokenExpiry) > new Date()
    ) {
      return config.onedrive.accessToken;
    }

    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.onedrive.refreshToken,
        client_id: config.onedrive.clientId,
        client_secret: config.onedrive.clientSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive token refresh failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    config.onedrive.accessToken = data.access_token;
    config.onedrive.accessTokenExpiry = new Date(
      Date.now() + data.expires_in * 1000
    ).toISOString();
    if (data.refresh_token) {
      config.onedrive.refreshToken = data.refresh_token;
    }
    await saveConfig(config);

    return data.access_token;
  }
}

function toDirectDownload(shareUrl: string): string {
  // Convert OneDrive sharing URL to direct download
  // https://1drv.ms/... → encode to base64 and use download API
  // The standard approach: append ?download=1 or use the /download endpoint
  // For sharing links, the most reliable method is the base64 encoding trick
  const base64 = Buffer.from(shareUrl, "utf-8").toString("base64");
  const encoded = "u!" + base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  return `${GRAPH_BASE}/shares/${encoded}/driveItem/content`;
}

// Register on import
registerProvider("onedrive", async () => new OneDriveProvider());
