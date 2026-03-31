import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Dropcast</h1>
        <p className="text-gray-400">
          API status: <span className="text-green-400">{health}</span>
        </p>
      </div>
    </div>
  );
}
