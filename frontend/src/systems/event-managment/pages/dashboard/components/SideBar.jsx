import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, 
  FiMessageSquare, FiBarChart2, FiMapPin, FiLogOut, FiUser,
  FiClipboard, FiUserCheck, FiLogIn, FiLogOut as FiExit, FiList, FiArrowRight,
  FiChevronRight, FiShield, FiFile, FiStar, FiActivity, FiCheck, FiLayers,
  FiCalendar
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { IoExitOutline } from 'react-icons/io5';
import SideBarLinks from "./utils/links";

const getIcon = (iconName) => {
  const icons = {
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
    FiExit,
    FiList,
    FiArrowRight,
    FiShield,
    FiStar,
    HiOutlineOfficeBuilding,
    FiDoorExit: IoExitOutline,
    FiActivity,
    FiCheck,
    FiLayers,
    FiFile,
    FiCalendar,
  };
  return icons[iconName] || FiGrid;
};

export default function SideBar({ isOpen, onToggle, isDesktop = true, mockUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const links = SideBarLinks();

  // Use mock user data
  const displayName = mockUser?.fullName || 'User';
  const displayRole = mockUser?.role || 'Guest';
  
  // Get first two initials from mock data
  const nameParts = displayName.trim().split(' ').filter(part => part.length > 0);
  const userInitial = nameParts.length >= 2 
    ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
    : displayName.charAt(0).toUpperCase();

  // Redirect if unknown
  if(links[0]?.id === 'unknown') {
    navigate(links[0].pathname);
    return <></>
  }

  // Dynamic state for collapsible menus
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const initial = new Set();
    links.forEach(link => {
      const children = link.children || [];
      const linkPath = link.pathname;
      let isLinkActive = location.pathname === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (location.pathname === child.pathname || location.pathname.startsWith(child.pathname + '/')) {
            isLinkActive = true;
            break;
          }
        }
      }
      if (isLinkActive) {
        initial.add(link.id || link.name);
      }
    });
    return initial;
  });

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  useEffect(() => {
    links.forEach(link => {
      const children = link.children || [];
      const linkPath = link.pathname;
      let isLinkActive = location.pathname === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (location.pathname === child.pathname || location.pathname.startsWith(child.pathname + '/')) {
            isLinkActive = true;
            break;
          }
        }
      }
      
      if (isLinkActive) {
        setExpandedMenus(prev => {
          const menuKey = link.id || link.name;
          if (!prev.has(menuKey)) {
            const next = new Set(prev);
            next.add(menuKey);
            return next;
          }
          return prev;
        });
      }
    });
  }, [location.pathname, links]);

  const handleNavigation = (path) => {
    navigate(path);
    if (!isDesktop) {
      onToggle();
    }
  };

  const handleLogout = () => {
    // Mock logout - redirect to login page
    window.location.href = '/login';
  };

  // Bulletproof tab-aware routing logic
  const isActive = (path, children) => {
    const currentPathname = location.pathname;
    const currentSearch = location.search;
    const currentFullPath = currentPathname + currentSearch;

    if (currentPathname?.includes('/visitors/') && path.endsWith('/dashboard')) {
      const pathRoleSlug = path.split('/')[1];
      const currentRoleSlug = currentPathname.split('/')[1];
      if (pathRoleSlug && pathRoleSlug === currentRoleSlug) return true;
    }
    
    const linkPathname = path.split('?')[0];
    const linkSearch = path.includes('?') ? '?' + path.split('?')[1] : '';

    if (currentFullPath === path) return true;

    if (currentPathname === linkPathname) {
      const urlParams = new URLSearchParams(currentSearch);
      const linkParams = new URLSearchParams(linkSearch);
      
      const currentTab = urlParams.get('tab');
      const linkTab = linkParams.get('tab');

      if (currentTab) {
        if (linkTab === currentTab) return true;
        if (currentTab === 'dashboard' && !linkTab) return true;
      } else {
        if (!linkTab || linkTab === 'dashboard') return true;
      }
    }

    if (currentPathname.startsWith(linkPathname + '/') && linkPathname !== '/') return true;

    if (children && children.length > 0) {
      for (const child of children) {
        const childPathname = child.pathname.split('?')[0];
        const childParams = new URLSearchParams(child.pathname.includes('?') ? '?' + child.pathname.split('?')[1] : '');
        const childTab = childParams.get('tab');
        const currentTab = new URLSearchParams(currentSearch).get('tab');

        if (currentPathname === childPathname) {
          if (currentTab) {
            if (childTab === currentTab) return true;
            if (currentTab === 'dashboard' && !childTab) return true;
          } else {
            if (!childTab || childTab === 'dashboard') return true;
          }
        }
        if (currentPathname.startsWith(childPathname + '/')) return true;
      }
    }
    
    return false;
  };

  return (
    <aside 
      className="fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50 flex flex-col w-64"
    >
      {/* Top Header Section */}
      <div className="h-20 flex items-center  px-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src="/LOGO_COK.png" 
            alt="COK Logo" 
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-900">COKEVENTS</span>
            <span className="text-xs font-medium text-sky-500 uppercase tracking-wide">{displayRole}</span>
          </div>
        </div>
      </div>

     

      {/* Nav Content */}
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {links.map((link) => {
          const Icon = getIcon(link.icon || (link.name === "Rooms" ? "FiLayers" : "FiActivity"));
          const children = link.children || [];
          const hasChildren = children.length > 0;
          const menuKey = link.id || link.name;
          const isExpanded = expandedMenus.has(menuKey);
          const linkIsActive = isActive(link.pathname, children);
          
          return (
            <div key={menuKey}>
              {hasChildren ? (
                <div className="relative">
                  <button
                    onClick={() => toggleMenu(menuKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      linkIsActive 
                        ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? 'text-white' : ''}`} />
                    <span className="font-medium text-sm truncate flex-1 text-left">{link.name}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMenu(menuKey);
                      }}
                      className="p-1 hover:bg-gray-200 rounded cursor-pointer"
                      role="button"
                      aria-label={isExpanded ? 'Collapse menu' : 'Expand menu'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          toggleMenu(menuKey);
                        }
                      }}
                    >
                      <FiChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${linkIsActive ? 'text-white' : 'text-gray-400'}`} />
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleNavigation(link.pathname)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    linkIsActive 
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? 'text-white' : ''}`} />
                  <span className="font-medium text-sm truncate">{link.name}</span>
                </button>
              )}
              
              {/* Children Menu */}
              {hasChildren && isExpanded && (
                <div className="py-2 space-y-1 ml-5 mt-2 border-l-2 flex flex-col gap-1 border-gray-200 pl-2">
                  {children.map((child, index) => {
                    const defaultChildIcon = child.name.includes("All") || child.name.includes("Live") ? "FiList" : "FiFile";
                    const ChildIcon = getIcon(child.icon || defaultChildIcon);
                    const childIsActive = isActive(child.pathname);
                    
                    return (
                      <button
                        key={child.pathname + index}
                        onClick={() => handleNavigation(child.pathname)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                          childIsActive 
                            ? 'bg-blue-100 text-blue-700 font-medium' 
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
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

      {/* Bottom Profile Section */}
      <div className="h-16 border-t border-gray-200 bg-white">
        <div className="flex items-center px-4 h-full gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {userInitial}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{displayRole}</p>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Logout"
          >
            <FiLogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}