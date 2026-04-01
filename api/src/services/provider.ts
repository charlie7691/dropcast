export type ProviderId = "dropbox" | "onedrive";

export interface CloudFile {
  name: string;
  path: string;
  id?: string; // OneDrive item ID (needed for createLink)
  size: number;
  modified: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CloudProvider {
  id: ProviderId;
  getAuthorizeUrl(redirectUri: string): Promise<string>;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  listFiles(folderPath: string): Promise<CloudFile[]>;
  getDownloadLink(fileRef: string): Promise<string>;
  listFolders(path: string): Promise<Array<{ name: string; path: string }>>;
}

const providers = new Map<ProviderId, () => Promise<CloudProvider>>();

export function registerProvider(
  id: ProviderId,
  factory: () => Promise<CloudProvider>
) {
  providers.set(id, factory);
}

export async function getProvider(id: ProviderId): Promise<CloudProvider> {
  const factory = providers.get(id);
  if (!factory) throw new Error(`Unknown provider: ${id}`);
  return factory();
}

// Shared utilities

const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".m4a", ".m4b", ".mp4", ".m4v", ".mov", ".wav", ".ogg", ".flac", ".aac",
]);

export function isMediaFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/x-m4a",
    ".m4b": "audio/x-m4b",
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
