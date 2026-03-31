import { readFile, writeFile, unlink, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Storage } from "./storage.js";

export class LocalStorage implements Storage {
  constructor(private baseDir: string) {}

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async readJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await readFile(this.resolve(key), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async writeJson(key: string, data: unknown): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  }

  async readText(key: string): Promise<string | null> {
    try {
      return await readFile(this.resolve(key), "utf-8");
    } catch {
      return null;
    }
  }

  async writeText(key: string, content: string): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // ignore if not found
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const dir = this.resolve(prefix);
      const entries = await readdir(dir);
      return entries.map((e) => `${prefix}/${e}`);
    } catch {
      return [];
    }
  }
}
