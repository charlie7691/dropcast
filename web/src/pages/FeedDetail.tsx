import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Episode {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

interface FeedDetail {
  id: string;
  title: string;
  description: string;
  author: string;
  email: string;
  language: string;
  category: string;
  explicit: boolean;
  imageUrl: string;
  dropboxFolder: string;
  episodeCount: number;
  lastRefreshed: string | null;
  episodes: Episode[];
}

export default function FeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<FeedDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<FeedDetail>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadFeed();
  }, [id]);

  async function loadFeed() {
    const data = await api.get<FeedDetail>(`/api/feeds/${id}`);
    setFeed(data);
    setForm(data);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.put(`/api/feeds/${id}`, form);
      setEditing(false);
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this feed?")) return;
    await api.delete(`/api/feeds/${id}`);
    navigate("/feeds");
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      await api.post(`/api/feeds/${id}/refresh`);
      // Trigger actual refresh by hitting RSS endpoint
      await fetch(`/rss/${id}`);
      await loadFeed();
    } finally {
      setLoading(false);
    }
  }

  function copyRssUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/rss/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!feed) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{feed.title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* RSS URL */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400 mb-1">RSS Feed URL</div>
          <code className="text-sm text-blue-400">
            {window.location.origin}/rss/{id}
          </code>
        </div>
        <button
          onClick={copyRssUrl}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Feed info / edit form */}
      {editing ? (
        <form
          onSubmit={handleSave}
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="Title"
              value={form.title || ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Author"
              value={form.author || ""}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Dropbox Folder"
              value={form.dropboxFolder || ""}
              onChange={(e) =>
                setForm({ ...form, dropboxFolder: e.target.value })
              }
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Category"
              value={form.category || ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
          >
            Save
          </button>
        </form>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Dropbox Folder:</span>{" "}
            {feed.dropboxFolder}
          </div>
          <div>
            <span className="text-gray-400">Author:</span> {feed.author}
          </div>
          <div>
            <span className="text-gray-400">Category:</span> {feed.category}
          </div>
          <div>
            <span className="text-gray-400">Language:</span> {feed.language}
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Description:</span>{" "}
            {feed.description}
          </div>
          <div>
            <span className="text-gray-400">Last Refreshed:</span>{" "}
            {feed.lastRefreshed
              ? new Date(feed.lastRefreshed).toLocaleString()
              : "Never"}
          </div>
          <div>
            <span className="text-gray-400">Episodes:</span>{" "}
            {feed.episodeCount}
          </div>
        </div>
      )}

      {/* Episode list */}
      {feed.episodes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Episodes</h3>
          <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {feed.episodes.map((ep) => (
              <div key={ep.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <div className="text-gray-200">{ep.filename}</div>
                  <div className="text-gray-500">
                    {ep.mimeType} &middot; {formatSize(ep.size)}
                  </div>
                </div>
                <div className="text-gray-500">
                  {new Date(ep.modifiedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
