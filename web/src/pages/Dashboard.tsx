import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface DropboxStatus {
  connected: boolean;
  hasCredentials: boolean;
}

interface Feed {
  id: string;
  title: string;
  dropboxFolder: string;
}

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

export default function Dashboard() {
  const [dbStatus, setDbStatus] = useState<DropboxStatus | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get<DropboxStatus>("/api/dropbox/status").then(setDbStatus);
    api.get<{ feeds: Feed[] }>("/api/feeds").then((d) => setFeeds(d.feeds));
    api
      .get<{ logs: LogEntry[] }>("/api/logs")
      .then((d) => setLogs(d.logs.slice(0, 5)));
  }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Dropbox</div>
          <div className="text-lg font-semibold">
            {dbStatus === null
              ? "Loading..."
              : dbStatus.connected
                ? "Connected"
                : "Not connected"}
          </div>
          <Link to="/dropbox" className="text-sm text-blue-400 hover:underline">
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

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Recent Activity</div>
          <div className="text-lg font-semibold">{logs.length} entries</div>
          <Link to="/logs" className="text-sm text-blue-400 hover:underline">
            View all
          </Link>
        </div>
      </div>

      {logs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
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
