export interface Storage {
  readJson<T>(key: string): Promise<T | null>;
  writeJson(key: string, data: unknown): Promise<void>;
  readText(key: string): Promise<string | null>;
  writeText(key: string, content: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

let _storage: Storage;

export function setStorage(s: Storage) {
  _storage = s;
}

export function getStorage(): Storage {
  if (!_storage) throw new Error("Storage not initialized");
  return _storage;
}
