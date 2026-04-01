import { sign, verify } from "hono/jwt";
import bcrypt from "bcryptjs";
import { getStorage } from "./storage.js";

export interface AppConfig {
  username: string;
  passwordHash: string;
  jwtSecret: string;
  dropbox?: {
    appKey: string;
    appSecret: string;
    refreshToken?: string;
    accessToken?: string;
    accessTokenExpiry?: string;
  };
  onedrive?: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
    accessToken?: string;
    accessTokenExpiry?: string;
  };
}

export async function getConfig(): Promise<AppConfig | null> {
  return getStorage().readJson<AppConfig>("config.json");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await getStorage().writeJson("config.json", config);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function createToken(
  username: string,
  secret: string
): Promise<string> {
  return sign(
    { sub: username, iat: Math.floor(Date.now() / 1000) },
    secret
  );
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    return (await verify(token, secret, "HS256")) as { sub: string };
  } catch {
    return null;
  }
}
