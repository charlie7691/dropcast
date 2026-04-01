import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface ProviderStatus {
  connected: boolean;
  hasCredentials: boolean;
}

interface Feed {
  id: string;
  title: string;
  provider: string;
  folderPath: string;
}

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

export default function Dashboard() {
  const [dropbox, setDropbox] = useState<ProviderStatus | null>(null);
  const [onedrive, setOnedrive] = useState<ProviderStatus | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get<ProviderStatus>("/api/dropbox/status").then(setDropbox).catch(() => {});
    api.get<ProviderStatus>("/api/onedrive/status").then(setOnedrive).catch(() => {});
    api.get<{ feeds: Feed[] }>("/api/feeds").then((d) => setFeeds(d.feeds));
    api.get<{ logs: LogEntry[] }>("/api/logs").then((d) => setLogs(d.logs.slice(0, 5)));
  }, []);

  function statusLabel(s: ProviderStatus | null): string {
    if (!s) return "Loading...";
    return s.connected ? "Connected" : "Not connected";
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Dropbox</div>
          <div className="text-lg font-semibold">{statusLabel(dropbox)}</div>
          <Link to="/connections" className="text-sm text-blue-400 hover:underline">
            Manage
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">OneDrive</div>
          <div className="text-lg font-semibold">{statusLabel(onedrive)}</div>
          <Link to="/connections" className="text-sm text-blue-400 hover:underline">
            Manage
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Feeds</div>
          <div className="text-lg font-semibold">{feeds.length}</div>
          <Link to="/feeds" className="text-sm text-blue-400 hover:underline">
            Manage
          </Link>
        </div>
      </div>

      {logs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Link to="/logs" className="text-sm text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {logs.map((log, i) => (
              <div key={i} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-300">{log.details}</span>
                <span className="text-gray-500 shrink-0 ml-4">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
