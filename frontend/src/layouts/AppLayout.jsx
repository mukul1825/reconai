import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { isAuthed } from "../api/client";

export default function AppLayout() {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 px-8 py-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
