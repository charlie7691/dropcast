import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get<{ logs: LogEntry[] }>("/api/logs").then((d) => setLogs(d.logs));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Activity Log</h2>

      {logs.length === 0 ? (
        <div className="text-gray-400 text-center py-12">No activity yet.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {logs.map((log, i) => (
            <div key={i} className="px-4 py-3 flex items-start justify-between text-sm">
              <div>
                <span className="inline-block bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs mr-2">
                  {log.action}
                </span>
                <span className="text-gray-300">{log.details}</span>
              </div>
              <span className="text-gray-500 shrink-0 ml-4 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
