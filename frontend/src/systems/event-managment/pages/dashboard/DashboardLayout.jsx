import { Outlet } from "react-router-dom";
import MainLayout from "@/core/components/Layout/MainLayout";

export default function DashboardLayout() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}
