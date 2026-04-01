import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import FolderPicker from "../components/FolderPicker";

interface Feed {
  id: string;
  title: string;
  description: string;
  author: string;
  email: string;
  language: string;
  category: string;
  explicit: boolean;
  imageUrl: string;
  provider: string;
  folderPath: string;
}

const defaultFeed = {
  title: "",
  description: "",
  author: "",
  email: "",
  language: "en",
  category: "Technology",
  explicit: false,
  imageUrl: "",
  provider: "dropbox",
  folderPath: "",
};

const providerLabels: Record<string, string> = {
  dropbox: "Dropbox",
  onedrive: "OneDrive",
};

export default function Feeds() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultFeed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFeeds();
  }, []);

  async function loadFeeds() {
    const data = await api.get<{ feeds: Feed[] }>("/api/feeds");
    setFeeds(data.feeds);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/api/feeds", form);
      setForm(defaultFeed);
      setShowForm(false);
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create feed");
    } finally {
      setLoading(false);
    }
  }

  function getRssUrl(id: string) {
    return `${window.location.origin}/rss/${id}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feeds</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          {showForm ? "Cancel" : "New Feed"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="Podcast Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
              required
            />
            <input
              placeholder="Author"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
              required
            />
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="dropbox">Dropbox</option>
              <option value="onedrive">OneDrive</option>
            </select>
            <FolderPicker
              provider={form.provider}
              value={form.folderPath}
              onChange={(path) => setForm({ ...form, folderPath: path })}
            />
            <input
              placeholder="Language (e.g. en)"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Category (e.g. Technology)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Image URL (optional)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            required
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="explicit"
              checked={form.explicit}
              onChange={(e) => setForm({ ...form, explicit: e.target.checked })}
            />
            <label htmlFor="explicit" className="text-sm text-gray-300">
              Explicit content
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            {loading ? "Creating..." : "Create Feed"}
          </button>
        </form>
      )}

      {feeds.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          No feeds yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <Link
                  to={`/feeds/${feed.id}`}
                  className="text-lg font-medium hover:text-blue-400"
                >
                  {feed.title}
                </Link>
                <div className="text-sm text-gray-400">
                  <span className="inline-block bg-gray-800 px-1.5 py-0.5 rounded text-xs mr-2">
                    {providerLabels[feed.provider] || feed.provider}
                  </span>
                  {feed.folderPath}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded max-w-xs truncate">
                  {getRssUrl(feed.id)}
                </code>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(getRssUrl(feed.id))
                  }
                  className="text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  Copy RSS
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
