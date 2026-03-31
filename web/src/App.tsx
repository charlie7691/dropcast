import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DropboxConnect from "./pages/DropboxConnect";
import Feeds from "./pages/Feeds";
import FeedDetail from "./pages/FeedDetail";
import Logs from "./pages/Logs";
import Layout from "./components/Layout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dropbox" element={<DropboxConnect />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="feeds/:id" element={<FeedDetail />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
