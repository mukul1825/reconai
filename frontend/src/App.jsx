import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import UploadBatchPage from "./pages/UploadBatchPage";
import DashboardPage from "./pages/DashboardPage";
import ExceptionsPage from "./pages/ExceptionsPage";
import AuditTrailPage from "./pages/AuditTrailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/upload" element={<UploadBatchPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/audit" element={<AuditTrailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
