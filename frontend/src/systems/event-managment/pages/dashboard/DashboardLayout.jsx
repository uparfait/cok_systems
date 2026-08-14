import { Outlet, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import MainLayout from "@/core/components/Layout/MainLayout";

export default function DashboardLayout() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <Outlet />
      {/* Fixed back button shown on every event-manager page */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        title="Back"
        aria-label="Go back"
        className="cok-btn-outlined-reverse fixed z-50 flex items-center justify-center cursor-pointer"
        style={{ width: "30px", height: "30px", padding: 0, right: "16px", bottom: "16px" }}
      >
        <FiArrowLeft className="w-4 h-4" />
      </button>
    </MainLayout>
  );
}
