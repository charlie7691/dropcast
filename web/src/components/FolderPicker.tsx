import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Folder {
  name: string;
  path: string;
}

interface FolderPickerProps {
  provider: string;
  value: string;
  onChange: (path: string) => void;
}

export default function FolderPicker({
  provider,
  value,
  onChange,
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders(currentPath);
    }
  }, [open, currentPath, provider]);

  async function loadFolders(path: string) {
    setLoading(true);
    setError("");
    try {
      const apiPath = provider === "onedrive" ? "onedrive" : "dropbox";
      const data = await api.get<{ folders: Folder[] }>(
        `/api/${apiPath}/folders?path=${encodeURIComponent(path)}`
      );
      setFolders(data.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  function navigateTo(path: string) {
    setCurrentPath(path);
  }

  function selectCurrent() {
    onChange(currentPath || "/");
    setOpen(false);
  }

  function selectFolder(folder: Folder) {
    onChange(folder.path);
    setOpen(false);
  }

  const breadcrumbs = currentPath
    ? currentPath.split("/").filter(Boolean)
    : [];

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer flex items-center justify-between focus:outline-none focus:border-blue-500"
      >
        <span className={value ? "text-white" : "text-gray-500"}>
          {value || "Select folder..."}
        </span>
        <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="mt-1 bg-gray-800 border border-gray-700 rounded overflow-hidden">
          {/* Breadcrumb navigation */}
          <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-1 text-sm flex-wrap">
            <button
              type="button"
              onClick={() => loadFolders(currentPath)}
              className="text-gray-400 hover:text-white mr-1"
              title="Refresh"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={() => navigateTo("")}
              className="text-blue-400 hover:underline"
            >
              Root
            </button>
            {breadcrumbs.map((segment, i) => {
              const path = "/" + breadcrumbs.slice(0, i + 1).join("/");
              return (
                <span key={path} className="flex items-center gap-1">
                  <span className="text-gray-600">/</span>
                  <button
                    type="button"
                    onClick={() => navigateTo(path)}
                    className="text-blue-400 hover:underline"
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </div>

          {/* Folder list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-gray-400 text-sm text-center">
                Loading...
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-red-400 text-sm text-center">
                {error}
              </div>
            ) : folders.length === 0 ? (
              <div className="px-3 py-4 text-gray-500 text-sm text-center">
                No subfolders
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.path}
                  className="px-3 py-2 flex items-center justify-between hover:bg-gray-700 group"
                >
                  <button
                    type="button"
                    onClick={() => navigateTo(folder.path)}
                    className="text-sm text-gray-300 hover:text-white flex items-center gap-2"
                  >
                    <span className="text-gray-500">📁</span>
                    {folder.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectFolder(folder)}
                    className="text-xs text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100"
                  >
                    Select
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Select current folder button */}
          <div className="px-3 py-2 border-t border-gray-700">
            <button
              type="button"
              onClick={selectCurrent}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Use current folder{currentPath ? `: ${currentPath}` : " (root)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
