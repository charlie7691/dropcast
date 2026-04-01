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

function getCredentials() {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("OneDrive credentials not configured (set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET)");
  return { clientId, clientSecret };
}

class OneDriveProvider implements CloudProvider {
  id = "onedrive" as const;

  async getAuthorizeUrl(redirectUri: string): Promise<string> {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "files.read offline_access",
    });
    return `${AUTH_BASE}/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const { clientId, clientSecret } = getCredentials();

    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
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
        if (item.file && isMediaFile(item.name)) {
          files.push({
            name: item.name,
            path: item.id,
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
    const { clientId, clientSecret } = getCredentials();
    const config = await getConfig();

    if (!config?.onedrive?.refreshToken) {
      throw new Error("OneDrive not connected");
    }

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
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive token refresh failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!config.onedrive) config.onedrive = {};
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
  const base64 = Buffer.from(shareUrl, "utf-8").toString("base64");
  const encoded = "u!" + base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  return `${GRAPH_BASE}/shares/${encoded}/driveItem/content`;
}

registerProvider("onedrive", async () => new OneDriveProvider());
