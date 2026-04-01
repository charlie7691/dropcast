import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface ProviderStatus {
  connected: boolean;
  hasCredentials: boolean;
}

interface ProviderConfig {
  id: string;
  name: string;
  apiPath: string;
}

const providers: ProviderConfig[] = [
  { id: "dropbox", name: "Dropbox", apiPath: "dropbox" },
  { id: "onedrive", name: "OneDrive", apiPath: "onedrive" },
];

export default function Connections() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStatuses();
  }, []);

  async function loadStatuses() {
    const results: Record<string, ProviderStatus> = {};
    for (const p of providers) {
      try {
        results[p.id] = await api.get<ProviderStatus>(`/api/${p.apiPath}/status`);
      } catch {
        results[p.id] = { connected: false, hasCredentials: false };
      }
    }
    setStatuses(results);
  }

  async function handleConnect(provider: ProviderConfig) {
    setLoading(provider.id);
    setError("");
    try {
      const { url } = await api.get<{ url: string }>(
        `/api/${provider.apiPath}/authorize`
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setLoading(null);
    }
  }

  async function handleDisconnect(provider: ProviderConfig) {
    setLoading(provider.id);
    try {
      await api.post(`/api/${provider.apiPath}/disconnect`);
      await loadStatuses();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Connections</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const status = statuses[provider.id];

          return (
            <div
              key={provider.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold mb-4">{provider.name}</h3>

              {!status ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : !status.hasCredentials ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-600 rounded-full" />
                  <span className="text-sm text-gray-500">Not available</span>
                </div>
              ) : status.connected ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm text-gray-300">Connected</span>
                  </div>
                  <button
                    onClick={() => handleDisconnect(provider)}
                    disabled={loading === provider.id}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm"
                  >
                    {loading === provider.id ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-sm text-gray-400">Not connected</span>
                  </div>
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={loading === provider.id}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
                  >
                    {loading === provider.id
                      ? "Connecting..."
                      : `Connect ${provider.name}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
