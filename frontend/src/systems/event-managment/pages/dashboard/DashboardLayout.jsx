import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import SideBar from "./components/SideBar";
import { Header } from "@/core/components/Layout";

// Mock user data
const mockUser = {
  fullName: "Uwayo Parfait",
  role: "Event Manager",
  email: "uwayo.parfait@cok.rw",
  departmentName: "Events & Protocol",
  department_name: "Events & Protocol"
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const nowDesktop = window.innerWidth >= 1024;
      setIsDesktop(nowDesktop);
      setIsSidebarOpen(nowDesktop);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle navigation
  const handleNavigation = (path) => {
    navigate(path);
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };

  // Get current system name from mock data
  const getCurrentSystemName = () => {
    return "Event Manager"
  };

  return (
    <div className="relative flex w-full h-full min-h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && !isDesktop && (
        <div 
          className="fixed inset-0 backdrop-blur-md bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - always visible on desktop, toggled on mobile */}
      <div className={`fixed inset-y-0 left-0 bg-red-200 z-40 transition-transform duration-300 
        lg:translate-x-0 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${!isSidebarOpen && 'lg:block hidden'}
      `}>
        <SideBar 
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(false)}
          isDesktop={isDesktop}
          mockUser={mockUser}
        />
      </div>

     
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden ${isDesktop ? 'lg:ml-64 ml-0' : 'ml-0'}`}>
        <Header 
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={location.pathname}
        onNavigate={handleNavigation}
        currentSystem={getCurrentSystemName()}
       
        
        />
        
        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4  lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}