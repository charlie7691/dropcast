import { getStorage } from "./storage.js";

export interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

const MAX_ENTRIES = 500;

export async function log(action: string, details: string): Promise<void> {
  const storage = getStorage();
  const entries =
    (await storage.readJson<LogEntry[]>("logs/activity.json")) || [];

  entries.unshift({
    timestamp: new Date().toISOString(),
    action,
    details,
  });

  // Cap at MAX_ENTRIES
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }

  await storage.writeJson("logs/activity.json", entries);
}

export async function getLogs(): Promise<LogEntry[]> {
  const storage = getStorage();
  return (await storage.readJson<LogEntry[]>("logs/activity.json")) || [];
}
