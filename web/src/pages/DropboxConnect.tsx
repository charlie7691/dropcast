import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface DropboxStatus {
  connected: boolean;
  hasCredentials: boolean;
}

export default function DropboxConnect() {
  const [status, setStatus] = useState<DropboxStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    const s = await api.get<DropboxStatus>("/api/dropbox/status");
    setStatus(s);
  }

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const { url } = await api.get<{ url: string }>("/api/dropbox/authorize");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await api.post("/api/dropbox/disconnect");
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  if (!status) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dropbox Connection</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {!status.hasCredentials ? (
          <div>
            <p className="text-gray-300 mb-2">
              Dropbox app credentials are not configured.
            </p>
            <p className="text-gray-400 text-sm">
              Run <code className="bg-gray-800 px-1 rounded">pnpm run setup</code> to
              set your Dropbox App Key and Secret.
            </p>
          </div>
        ) : status.connected ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-lg font-medium">Connected to Dropbox</span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm"
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-gray-500 rounded-full" />
              <span className="text-lg font-medium">Not connected</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Connect your Dropbox account to start creating podcast feeds.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
            >
              {loading ? "Connecting..." : "Connect Dropbox"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
