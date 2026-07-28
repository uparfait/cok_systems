import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, 
  FiMessageSquare, FiBarChart2, FiMapPin, FiLogOut, FiUser,
  FiClipboard, FiUserCheck, FiLogIn, FiLogOut as FiExit, FiList, FiArrowRight,
  FiChevronRight, FiShield, FiFile, FiStar,FiActivity,FiCheck,FiLayers,
  FiCalendar
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { IoExitOutline } from 'react-icons/io5';

// Custom SVG component for Parking "P" icon
const FiParkingIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    style={{ color: '#6b7280' }}
  >
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1.75A1.75 1.75 0 014.75 4h6.5a1.75 1.75 0 011.75 1.75v.5h-10v-.5zM7.75 7a2.25 2.25 0 104.5 0 2.25 2.25 0 00-4.5 0z" clipRule="evenodd" />
    <path d="M7 14a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" />
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
    FiActivity,FiCheck,FiLayers,
    FiFile,
    FiCalendar,
  };
  return icons[iconName] || FiGrid;
};

const FlipDigit: React.FC<{ digit: number }> = ({ digit }) => {
  const [prevDigit, setPrevDigit] = useState(digit);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (digit !== prevDigit) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setPrevDigit(digit);
        setAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [digit, prevDigit]);

  return (
    <div className="relative w-5 h-7 overflow-hidden">
      <span className={`absolute inset-0 flex items-center justify-center text-white text-base font-bold font-mono transition-transform duration-300 ${animating ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
        {prevDigit}
      </span>
      <span className={`absolute inset-0 flex items-center justify-center text-white text-base font-bold font-mono transition-transform duration-300 ${animating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        {digit}
      </span>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  onToggle, 
  isDesktop = true,
  links, 
  currentPath,
  onNavigate,
  userDepartment 
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  

  if(links[0]?.id === 'unknown') {
     navigate(links[0].path);
     return <></>
  }
  
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    links.forEach(link => {
      const children = link.children || [];
      const linkPath = link.path;
      let isLinkActive = currentPath === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (currentPath === child.path || location.pathname.startsWith(child.path + '/')) {
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
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  const toggleMenu = (menuId: string) => {
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
      const linkPath = link.path;
      let isLinkActive = currentPath === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (currentPath === child.path || location.pathname.startsWith(child.path + '/')) {
            isLinkActive = true;
            break;
          }
        }
      }
      
      if (isLinkActive && link.id) {
        setExpandedMenus(prev => {
          if (!prev.has(link.id)) {
            const next = new Set(prev);
            next.add(link.id);
            return next;
          }
          return prev;
        });
      }
    });
  }, [location.pathname, currentPath, links]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigation = (path: string) => {
    onNavigate(path);
    if (!isDesktop) {
      onToggle();
    }
  };

  const displayName = user?.fullName || 'User';
  const displayRole = user?.role || 'Guest';
  
  const nameParts = displayName.trim().split(' ').filter(part => part.length > 0);
  const userInitial = nameParts.length >= 2 
    ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
    : displayName.charAt(0).toUpperCase();

  // const handleLogout = async () => {
  //   try {
  //     await logout();
  //   } catch (error) {
  //     console.error('Logout error:', error);
  //     window.location.href = '/login';
  //   }
  // };

 
  const isActive = (path: string, children?: SidebarLink[]): boolean => {
    const currentPathname = location.pathname;
    const currentSearch = location.search;
    const currentFullPath = currentPathname + currentSearch;

    // Match visitor detail pages to the employee dashboard link (role-slug based)
    if (currentPathname?.includes('/visitors/') && path.endsWith('/dashboard')) {
      const pathRoleSlug = path.split('/')[1];
      const currentRoleSlug = currentPathname.split('/')[1];
      if (pathRoleSlug && pathRoleSlug === currentRoleSlug) return true;
    }
    
    const linkPathname = path.split('?')[0];
    const linkSearch = path.includes('?') ? '?' + path.split('?')[1] : '';

    // 1. Exact match including query string
    //if()
    if (currentFullPath === path) return true;

    // 2. Base path match handling tabs
    if (currentPathname === linkPathname) {
      const urlParams = new URLSearchParams(currentSearch);
      const linkParams = new URLSearchParams(linkSearch);
      
      const currentTab = urlParams.get('tab');
      const linkTab = linkParams.get('tab');

      // If the URL has a tab, only match the link that has the exact same tab
      if (currentTab) {
        if (linkTab === currentTab) return true;
        // Special case: If URL is tab=dashboard, but the link is just the base path, highlight it
        if (currentTab === 'dashboard' && !linkTab) return true;
      } else {
        // If URL has NO tab, match the base link or the link explicitly defined as tab=dashboard
        if (!linkTab || linkTab === 'dashboard') return true;
      }
    }

    // 3. Sub-route matching (e.g., /smart-parking/dashboard/details matches /smart-parking/dashboard)
    if (currentPathname.startsWith(linkPathname + '/') && linkPathname !== '/' && children && children.length > 0) return true;

    // 4. Children matching
    if (children && children.length > 0) {
      for (const child of children) {
        const childPathname = child.path.split('?')[0];
        const childParams = new URLSearchParams(child.path.includes('?') ? '?' + child.path.split('?')[1] : '');
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

  const getChildren = (parent: SidebarLink): SidebarLink[] => {
    return parent.children || [];
  };

  const parentLinks = links.filter(link => link.isParent);

  return (
    <aside 
      className="fixed left-0 select-none top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50 flex flex-col w-64"
    >
      <div className="h-20 flex items-center cursor-pointer px-4 border-b border-gray-200" onClick={()=>{
        navigate('/')
      }}>
        <div className="flex items-center gap-3">
          <img 
            src="/LOGO_COK.png" 
            alt="COK Logo" 
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-700">KIGALI CITY</span>
            <span className="text-xs font-medium text-sky-500 uppercase tracking-wide">{displayRole}</span>
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
                        ? 'cok-primary-bg-hoverable text-white shadow-md  hover:shadow-lg' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? 'text-white' : ''}`} />
                    <span className="font-medium text-sm truncate flex-1 text-left">{link.name}</span>
                    {hasChildren && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(link.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded cursor-pointer"
                        role="button"
                        aria-label={isExpanded ? 'Collapse menu' : 'Expand menu'}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            toggleMenu(link.id);
                          }
                        }}
                      >
                        <FiChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${linkIsActive ? 'text-white' : 'text-gray-400'}`} />
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleNavigation(link.path)}
                  className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    linkIsActive 
                      ? 'cok-primary-bg-hoverable text-white shadow-md  hover:shadow-lg' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? 'text-white' : ''}`} />
                  <span className="font-medium text-sm truncate">{link.name}</span>
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
                            ? 'bg-blue-100 cok-primary-color font-medium' 
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

      <div className="h-16 border-t border-t-gray-200 flex flex-col justify-between px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-baseline pt-2 gap-2">
            <span className="cok-primary-color text-2xl  font-bold leading-none tracking-tight">IKAZE</span>
            <span className="cok-primary-color font-mono text-sm sm:text-base font-medium">
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        </div>
        <div className="flex justify-end">
          <span className="cok-primary-color text-[15px] font-mono tracking-wider font-medium">
            {currentTime.getFullYear()}-{String(currentTime.getMonth() + 1).padStart(2, '0')}-{String(currentTime.getDate()).padStart(2, '0')}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;