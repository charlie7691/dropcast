import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../lib/api";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/connections", label: "Connections" },
  { to: "/feeds", label: "Feeds" },
  { to: "/logs", label: "Logs" },
];

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg">Dropcast</span>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `text-sm ${isActive ? "text-white" : "text-gray-400 hover:text-gray-200"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
