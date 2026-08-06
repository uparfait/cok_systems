import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiHome,
  FiGrid,
  FiTruck,
  FiUsers,
  FiSettings,
  FiMessageSquare,
  FiBarChart2,
  FiMapPin,
  FiLogOut,
  FiUser,
  FiClipboard,
  FiUserCheck,
  FiLogIn,
  FiLogOut as FiExit,
  FiList,
  FiArrowRight,
  FiChevronRight,
  FiShield,
   FiFile,
   FiFileText,
   FiStar,
  FiActivity,
  FiCheck,
  FiLayers,
  FiCalendar,
  FiDroplet,
  FiHardDrive,
} from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { IoExitOutline } from "react-icons/io5";
import { useSocket } from "@/core/contexts/SocketContext";

// Custom SVG component for Parking "P" icon
const FiParkingIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ color: "#6b7280" }}
  >
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1.75A1.75 1.75 0 014.75 4h6.5a1.75 1.75 0 011.75 1.75v.5h-10v-.5zM7.75 7a2.25 2.25 0 104.5 0 2.25 2.25 0 00-4.5 0z"
      clipRule="evenodd"
    />
    <path d="M7 14a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);

// SVG Icons for system metrics
const BatteryIcon = ({
  className,
  level,
  charging,
}: {
  className?: string;
  level?: number;
  charging?: boolean;
}) => {
  const getColor = () => {
    if (level === undefined) return "#6b7280";
    if (charging) return "#056daa"; // Blue when charging
    if (level <= 20) return "#ef4444";
    if (level <= 50) return "#eab308";
    return "#22c55e";
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={getColor()}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="7" width="16" height="10" rx="1" ry="1" />
      <line x1="22" y1="11" x2="22" y2="13" />
      {level !== undefined && level > 0 && (
        <rect
          x="4"
          y="9"
          width={Math.max(2, (level / 100) * 12)}
          height="6"
          fill={getColor()}
          stroke="none"
        />
      )}
      {/* Charging indicator - lightning bolt */}
      {charging && (
        <polyline
          points="11 3 8 11 12 11 10 21"
          stroke="#056daa"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

const CpuIcon = ({
  className,
  load,
}: {
  className?: string;
  load?: number;
}) => {
  const getColor = () => {
    if (load === undefined) return "#6b7280";
    if (load > 70) return "#ef4444";
    if (load > 40) return "#eab308";
    return "#056daa";
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={getColor()}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
};

const NetworkIcon = ({
  className,
  connected,
}: {
  className?: string;
  connected?: boolean;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke={connected ? "#056daa" : "#ef4444"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 8a8 8 0 0 1 16 0" />
    <path d="M7 11a5 5 0 0 1 10 0" />
    <path d="M10 14a2 2 0 0 1 4 0" />
    <circle cx="12" cy="17" r="1.5" fill={connected ? "#056daa" : "#ef4444"} />
  </svg>
);

const RttIcon = ({
  className,
  connected,
}: {
  className?: string;
  connected?: boolean;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke={connected ? "#056daa" : "#ef4444"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
    <path d="M8 8a6 6 0 0 1 8 0" />
  </svg>
);

interface SidebarLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  isParent: boolean;
  isExpandable?: boolean;
  parentId?: string;
  children?: SidebarLink[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isDesktop?: boolean;
  links: SidebarLink[];
  currentPath: string;
  onNavigate: (path: string) => void;
  userDepartment: string;
}

const getIcon = (iconName: string): React.ComponentType<any> => {
  const icons: { [key: string]: React.ComponentType<any> } = {
    FiHome,
    FiGrid,
    FiTruck,
    FiUsers,
    FiSettings,
    FiMessageSquare,
    FiBarChart: FiBarChart2,
    FiBarChart2,
    FiMapPin,
    FiLogOut,
    FiUser,
    FiClipboard,
    FiUserCheck,
    FiLogIn,
    FiExit,
    FiList,
    FiArrowRight,
    FiShield,
    FiStar,
    HiOutlineOfficeBuilding,
    FiDoorExit: IoExitOutline,
    FiParkingIcon,
    FiActivity,
    FiCheck,
    FiLayers,
    FiFile,
    FiFileText,
    FiCalendar,
    FiDroplet,
    FiHardDrive,
  };
  return icons[iconName] || FiGrid;
};

const Sidebar: React.FC<SidebarProps> = ({
  onToggle,
  isDesktop = true,
  links,
  currentPath,
  onNavigate,
  userDepartment,
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Use ref to track if this is the first render
  const isFirstRender = useRef(true);
  // Store previous location to detect changes
  const prevLocationRef = useRef(location.pathname);

  if (links[0]?.id === "unknown") {
    navigate(links[0].path);
    return <></>;
  }

  // Memoize the initial expanded state calculation
  const initialExpandedMenus = useMemo(() => {
    const initial = new Set<string>();
    links.forEach((link) => {
      const children = link.children || [];
      const linkPath = link.path;
      let isLinkActive =
        currentPath === linkPath ||
        location.pathname.startsWith(linkPath + "/");
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (
            currentPath === child.path ||
            location.pathname.startsWith(child.path + "/")
          ) {
            isLinkActive = true;
            break;
          }
        }
      }
      if (isLinkActive && link.id) {
        initial.add(link.id);
      }
    });
    return initial;
  }, [links, currentPath, location.pathname]);

  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    initialExpandedMenus
  );

  const [currentTime, setCurrentTime] = useState(new Date());
  const { socket, isConnected } = useSocket();

  // System metrics state
  const [batteryLevel, setBatteryLevel] = useState<number>(0);
  const [batteryCharging, setBatteryCharging] = useState<boolean>(false);
  const [cpuLoad, setCpuLoad] = useState<number>(0);
  const [networkSpeed, setNetworkSpeed] = useState<number>(0);
  const [networkType, setNetworkType] = useState<string>("--");
  const [networkRTT, setNetworkRTT] = useState<number>(0);
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean>(true);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  // Update expanded menus only when the location actually changes
  useEffect(() => {
    // Skip if the location hasn't changed
    if (prevLocationRef.current === location.pathname) {
      return;
    }
    
    // Skip first render to avoid overriding initial state
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevLocationRef.current = location.pathname;
      return;
    }

    // Update previous location
    prevLocationRef.current = location.pathname;

    // Check which menus should be expanded based on current route
    const newExpanded = new Set(expandedMenus);
    let shouldUpdate = false;

    links.forEach((link) => {
      const children = link.children || [];
      const linkPath = link.path;
      let isLinkActive =
        currentPath === linkPath ||
        location.pathname.startsWith(linkPath + "/");
      
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (
            currentPath === child.path ||
            location.pathname.startsWith(child.path + "/")
          ) {
            isLinkActive = true;
            break;
          }
        }
      }

      if (isLinkActive && link.id) {
        if (!newExpanded.has(link.id)) {
          newExpanded.add(link.id);
          shouldUpdate = true;
        }
      }
    });

    if (shouldUpdate) {
      setExpandedMenus(newExpanded);
    }
  }, [location.pathname, currentPath, links, expandedMenus]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Battery monitoring - keep as is
  useEffect(() => {
    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setBatteryCharging(battery.charging);
        };
        updateBattery();
        battery.addEventListener("levelchange", updateBattery);
        battery.addEventListener("chargingchange", updateBattery);
      });
    }
  }, []);

  // CPU load monitoring - keep as is
  useEffect(() => {
    let lastFrameTime = performance.now();
    const cpuHistory: number[] = [];

    const measureCpuLoad = () => {
      const now = performance.now();
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      const delay = Math.max(0, delta - 100);
      const loadEstimate = Math.min(100, Math.round((delay / 100) * 100));

      cpuHistory.push(loadEstimate);
      if (cpuHistory.length > 10) cpuHistory.shift();

      const avgLoad = Math.round(
        cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length,
      );
      setCpuLoad(avgLoad);
    };

    const cpuInterval = setInterval(measureCpuLoad, 100);
    return () => clearInterval(cpuInterval);
  }, []);

  // Network monitoring - keep as is
  useEffect(() => {
    const updateNetwork = () => {
      const conn =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;
      if (conn) {
        const downlink = conn.downlink || 0;
        setNetworkSpeed(downlink);
        setNetworkType((conn.effectiveType || "--").toUpperCase());
        setNetworkRTT(conn.rtt || 0);
        setIsNetworkConnected(navigator.onLine);
      }
    };

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn) {
      conn.addEventListener("change", updateNetwork);
    }

    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);

    updateNetwork();

    return () => {
      if (conn) {
        conn.removeEventListener("change", updateNetwork);
      }
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  const handleNavigation = (path: string) => {
    onNavigate(path);
    if (!isDesktop) {
      onToggle();
    }
  };

  const displayName = user?.fullName || "User";
  const displayRole = user?.role || "Guest";

  const nameParts = displayName
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  const userInitial =
    nameParts.length >= 2
      ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
      : displayName.charAt(0).toUpperCase();

  const isActive = (path: string, children?: SidebarLink[]): boolean => {
    const currentPathname = location.pathname;
    const currentSearch = location.search;
    const currentFullPath = currentPathname + currentSearch;

    if (
      currentPathname?.includes("/visitors/") &&
      path.endsWith("/dashboard")
    ) {
      const pathRoleSlug = path.split("/")[1];
      const currentRoleSlug = currentPathname.split("/")[1];
      if (pathRoleSlug && pathRoleSlug === currentRoleSlug) return true;
    }

    const linkPathname = path.split("?")[0];
    const linkSearch = path.includes("?") ? "?" + path.split("?")[1] : "";

    if (currentFullPath === path) return true;

    if (currentPathname === linkPathname) {
      const urlParams = new URLSearchParams(currentSearch);
      const linkParams = new URLSearchParams(linkSearch);

      const currentTab = urlParams.get("tab");
      const linkTab = linkParams.get("tab");

      if (currentTab) {
        if (linkTab === currentTab) return true;
        if (currentTab === "dashboard" && !linkTab) return true;
      } else {
        if (!linkTab || linkTab === "dashboard") return true;
      }
    }

    if (
      currentPathname.startsWith(linkPathname + "/") &&
      linkPathname !== "/" &&
      children &&
      children.length > 0
    )
      return true;

    if (children && children.length > 0) {
      for (const child of children) {
        const childPathname = child.path.split("?")[0];
        const childParams = new URLSearchParams(
          child.path.includes("?") ? "?" + child.path.split("?")[1] : "",
        );
        const childTab = childParams.get("tab");
        const currentTab = new URLSearchParams(currentSearch).get("tab");

        if (currentPathname === childPathname) {
          if (currentTab) {
            if (childTab === currentTab) return true;
            if (currentTab === "dashboard" && !childTab) return true;
          } else {
            if (!childTab || childTab === "dashboard") return true;
          }
        }
        if (currentPathname.startsWith(childPathname + "/")) return true;
      }
    }

    return false;
  };

  const getChildren = (parent: SidebarLink): SidebarLink[] => {
    return parent.children || [];
  };

  const parentLinks = links.filter((link) => link.isParent);

  return (
    <aside className="fixed left-0 select-none top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50 flex flex-col w-64">
      <div
        className="h-20 flex items-center cursor-pointer px-4 border-b border-gray-200"
        onClick={() => {
          navigate("/");
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/LOGO_COK.png"
            alt="COK Logo"
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-700">KIGALI CITY</span>
            <span className="text-xs font-medium text-sky-500 uppercase tracking-wide">
              {displayRole}
            </span>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {parentLinks.map((link) => {
          const Icon = getIcon(link.icon);
          const children = getChildren(link);
          const hasChildren = children.length > 0;
          const isExpanded = expandedMenus.has(link.id);

          const linkIsActive = isActive(link.path, children);

          return (
            <div key={link.id}>
              {hasChildren ? (
                <div className="relative ">
                  <button
                    onClick={() => {
                      if (!isExpanded) {
                        toggleMenu(link.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      linkIsActive
                        ? "cok-primary-bg-hoverable text-white shadow-md  hover:shadow-lg"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? "text-white" : ""}`}
                    />
                    <span className="font-medium text-sm truncate flex-1 text-left">
                      {link.name}
                    </span>
                    {hasChildren && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(link.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded cursor-pointer"
                        role="button"
                        aria-label={
                          isExpanded ? "Collapse menu" : "Expand menu"
                        }
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            toggleMenu(link.id);
                          }
                        }}
                      >
                        <FiChevronRight
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} ${linkIsActive ? "text-white" : "text-gray-400"}`}
                        />
                      </span>
                    )}
                  </button>
                  
                </div>
              ) : (
                <button
                  onClick={() => handleNavigation(link.path)}
                  className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    linkIsActive
                      ? "cok-primary-bg-hoverable text-white shadow-md  hover:shadow-lg"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? "text-white" : ""}`}
                  />
                  <span className="font-medium text-sm truncate">
                    {link.name}
                  </span>
                </button>
              )}

              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {children.map((child) => {
                    const ChildIcon = getIcon(child.icon);
                    const childIsActive = isActive(child.path);

                    return (
                      <button
                        key={child.id}
                        onClick={() => handleNavigation(child.path)}
                        className={`w-full flex cursor-pointer items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                          childIsActive
                            ? "bg-blue-100 cok-primary-color font-medium"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{child.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Component with System Metrics */}
      <div className="relative border-t border-gray-200 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
        {/* Wave SVG Background - fixed overflow */}
        <div className="absolute bottom-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <svg
            className="absolute bottom-0 left-0 w-full h-[90%] wave-svg"
            viewBox="0 0 2 1"
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
          >
            <defs>
              <path id="w" d="m0 1v-.5 q.5.5 1 0 t1 0 1 0 1 0 v.5z" />
            </defs>
            <g>
              {isConnected ? (
                <>
                  <use href="#w" y="0" fill="rgba(22, 163, 74, 0.12)" />
                  <use href="#w" y=".1" fill="rgba(34, 197, 94, 0.08)" />
                  <use href="#w" y=".2" fill="rgba(74, 222, 128, 0.05)" />
                </>
              ) : (
                <>
                  <use href="#w" y="0" fill="rgba(220, 53, 69, 0.12)" />
                  <use href="#w" y=".1" fill="rgba(239, 68, 68, 0.08)" />
                  <use href="#w" y=".2" fill="rgba(248, 113, 113, 0.05)" />
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 p-2 space-y-1.5">
          {/* Time and Status */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                Ikaze
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-600">
              {currentTime.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          </div>

          {/* System Metrics Grid - 4 items */}
          <div className="grid grid-cols-4 gap-1 px-0.5">
            {/* Battery */}
            <div className="bg-white/80 backdrop-blur-sm rounded px-1.5 py-1 border border-gray-200/50">
              <div className="flex items-center justify-between">
                <BatteryIcon
                  className="w-3 h-3 flex-shrink-0"
                  level={batteryLevel}
                  charging={batteryCharging}
                />

                <span className="text-[9px] font-mono font-bold text-gray-700">
                  {batteryLevel}%
                </span>
              </div>
              <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${batteryLevel}%`,
                    backgroundColor: batteryCharging
                      ? "#056daa"
                      : batteryLevel <= 20
                        ? "#ef4444"
                        : batteryLevel <= 50
                          ? "#eab308"
                          : "#22c55e",
                  }}
                />
              </div>
            </div>

            {/* CPU Load */}
            <div className="bg-white/80 backdrop-blur-sm rounded px-1.5 py-1 border border-gray-200/50">
              <div className="flex items-center justify-between">
                <CpuIcon className="w-3 h-3 flex-shrink-0" load={cpuLoad} />
                <span className="text-[9px] font-mono font-bold text-gray-700">
                  {cpuLoad}%
                </span>
              </div>
              <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${cpuLoad}%`,
                    backgroundColor:
                      cpuLoad > 70
                        ? "#ef4444"
                        : cpuLoad > 40
                          ? "#eab308"
                          : "#056daa",
                  }}
                />
              </div>
            </div>

            {/* Network Speed */}
            <div className="bg-white/80 backdrop-blur-sm rounded px-1.5 py-1 border border-gray-200/50">
              <div className="flex items-center justify-between">
                <NetworkIcon
                  className="w-3 h-3 flex-shrink-0"
                  connected={isNetworkConnected && networkSpeed > 0}
                />
                <span className="text-[9px] font-mono font-bold text-gray-700">
                  {networkSpeed > 0 ? networkSpeed.toFixed(1) : "0.0"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[7px] text-gray-400">Mbps</span>
                <span
                  className={`font-medium ${isNetworkConnected && networkSpeed > 0 ? "text-[#056daa] text-[8px]" : "text-red-500 text-[6px]"}`}
                >
                  {isNetworkConnected && networkSpeed > 0
                    ? networkType
                    : " OFFLINE"}
                </span>
              </div>
            </div>

            {/* RTT / Connection */}
            <div className="bg-white/80 backdrop-blur-sm rounded px-1.5 py-1 border border-gray-200/50">
              <div className="flex items-center justify-between">
                <RttIcon
                  className="w-3 h-3 flex-shrink-0"
                  connected={isNetworkConnected && networkRTT > 0}
                />
                <span className="text-[9px] font-mono font-bold text-gray-700">
                  {networkRTT > 0 ? networkRTT : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[7px] text-gray-400">RTT</span>
                <span
                  className={`font-medium ${isNetworkConnected && networkRTT > 0 ? "text-[#056daa] text-[8px]" : "text-red-500 text-[6px]"}`}
                >
                  {isNetworkConnected && networkRTT > 0 ? "ms" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="flex justify-end px-1">
            <span className="text-[8px] text-gray-400 font-mono">
              {currentTime.getFullYear()}-
              {String(currentTime.getMonth() + 1).padStart(2, "0")}-
              {String(currentTime.getDate()).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;