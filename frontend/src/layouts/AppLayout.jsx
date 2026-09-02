import { Outlet, Navigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { isAuthed } from "../api/client";

export default function AppLayout() {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-6xl min-w-0">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
