// Sidebar Component - Navigation sidebar with dynamic collapsible dropdowns
// Provides navigation links with expandable menus for each system

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, 
  FiMessageSquare, FiBarChart2, FiMapPin, FiLogOut, FiUser,
  FiClipboard, FiUserCheck, FiLogIn, FiLogOut as FiExit, FiList, FiArrowRight,
  FiChevronRight, FiShield, FiFile
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
  children?: SidebarLink[]; // Children embedded in parent
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

// Icon mapping
const getIcon = (iconName: string): React.ComponentType<any> => {
  const icons: { [key: string]: React.ComponentType<any> } = {
    FiHome,
    FiGrid,
    FiTruck,
    FiUsers,
    FiSettings,
    FiMessageSquare,
    FiBarChart: FiBarChart2,
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
    HiOutlineOfficeBuilding,
    FiDoorExit: IoExitOutline,
    FiParkingIcon,
    FiFile,
  };
  return icons[iconName] || FiGrid;
};

const Sidebar: React.FC<SidebarProps> = ({ 
  // isOpen prop is kept for potential future use (e.g., animation control)
  onToggle, 
  isDesktop = true,
  links, 
  currentPath,
  onNavigate,
  userDepartment 
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Track which dropdowns are expanded - auto-expand based on URL
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Find which parent should be expanded based on current path
    links.forEach(link => {
      const children = link.children || [];
      const linkPath = link.path;
      // Check if this link or any child should be active
      let isLinkActive = currentPath === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (currentPath === child.path || location.pathname.startsWith(child.path + '/')) {
            isLinkActive = true;
            break;
          }
          // Check path segments
          const childPathParts = child.path.split('/').slice(0, 3).join('/');
          const currentPathParts = currentPath.split('/').slice(0, 3).join('/');
          if (childPathParts === currentPathParts) {
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

  // Toggle dropdown
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

  // Keep dropdown expanded when navigating between child pages - URL based
  useEffect(() => {
    // Find which parent should be expanded based on current path
    links.forEach(link => {
      const children = link.children || [];
      const linkPath = link.path;
      // Check if this link or any child should be active
      let isLinkActive = currentPath === linkPath || location.pathname.startsWith(linkPath + '/');
      if (!isLinkActive && children.length > 0) {
        for (const child of children) {
          if (currentPath === child.path || location.pathname.startsWith(child.path + '/')) {
            isLinkActive = true;
            break;
          }
          // Check path segments
          const childPathParts = child.path.split('/').slice(0, 3).join('/');
          const currentPathParts = currentPath.split('/').slice(0, 3).join('/');
          if (childPathParts === currentPathParts) {
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

  // Handle navigation
  const handleNavigation = (path: string) => {
    onNavigate(path);
    if (!isDesktop) {
      onToggle();
    }
  };

  // Get user display info
  const displayName = user?.fullName || 'User';
  const displayRole = user?.role || 'Guest';
  
  // Get first two initials
  const nameParts = displayName.trim().split(' ').filter(part => part.length > 0);
  const userInitial = nameParts.length >= 2 
    ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
    : displayName.charAt(0).toUpperCase();

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  // Check if a link is active - check both direct match and if current path belongs to children
  const isActive = (path: string, children?: SidebarLink[]): boolean => {
    // Get pathname and remove query params for comparison
    const pathnameOnly = location.pathname;
    const pathOnly = path.split('?')[0];
    
    // Direct match (both without query params)
    if (pathnameOnly === pathOnly) return true;
    // Direct match including query params (for tabs)
    if (currentPath === path) return true;
    // Check if path with query params matches (e.g., /page?q=1)
    if (currentPath.startsWith(pathOnly)) return true;
    // Starts with path + '/' (for sub-routes)
    if (pathnameOnly.startsWith(pathOnly + '/')) return true;
    // Check if current path is any of the children paths
    if (children && children.length > 0) {
      for (const child of children) {
        const childPathOnly = child.path.split('?')[0];
        if (pathnameOnly === childPathOnly || currentPath === child.path || pathnameOnly.startsWith(child.path + '/')) {
          return true;
        }
        // Also check parent path segments (e.g., /smart-parking/checkin-vehicle for /smart-parking/checkin-person)
        const childPathParts = child.path.split('/').slice(0, 3).join('/');
        const currentPathParts = pathnameOnly.split('/').slice(0, 3).join('/');
        if (childPathParts === currentPathParts) {
          return true;
        }
        // Check with query params
        if (currentPath.startsWith(childPathOnly)) {
          return true;
        }
      }
    }
    return false;
  };

  // Get children directly from parent link
  const getChildren = (parent: SidebarLink): SidebarLink[] => {
    return parent.children || [];
  };

  // Get parent links (items with children or standalone)
  const parentLinks = links.filter(link => link.isParent);

  return (
    <aside 
      className="fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50 flex flex-col w-64"
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center px-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src="/LOGO_COK.png" 
            alt="COK Logo" 
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-900">KSESM Portal</span>
            <span className="text-xs font-medium text-sky-500 uppercase tracking-wide">{displayRole}</span>
          </div>
        </div>
      </div>

      {/* User Department Badge */}
      {userDepartment && (
        <div className="px-4 py-3">
          <div className="bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Department</p>
            <p className="text-sm text-gray-900 font-semibold truncate">{userDepartment}</p>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {parentLinks.map((link) => {
          const Icon = getIcon(link.icon);
          const children = getChildren(link);
          const hasChildren = children.length > 0;
          const isExpanded = expandedMenus.has(link.id);
          
          // Check if this link or any of its children is active - use URL-based detection
          const linkIsActive = isActive(link.path, children);
          
          return (
            <div key={link.id}>
              {/* Parent Link - Clickable or Expandable */}
              {hasChildren ? (
                // Dropdown header - chevron toggles, parent click expands but doesn't collapse
                <div className="relative">
                  <button
                    onClick={() => {
                      // If not expanded, expand it
                      if (!isExpanded) {
                        toggleMenu(link.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      linkIsActive 
                        ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${linkIsActive ? 'text-white' : ''}`} />
                    <span className="font-medium text-sm truncate flex-1 text-left">{link.name}</span>
                    {hasChildren && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(link.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <FiChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${linkIsActive ? 'text-white' : 'text-gray-400'}`} />
                      </button>
                    )}
                  </button>
                </div>
              ) : (
                // Single link - no dropdown
                <button
                  onClick={() => handleNavigation(link.path)}
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
              
              {/* Child Links - Dropdown Content */}
              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {children.map((child) => {
                    const ChildIcon = getIcon(child.icon);
                    const childIsActive = isActive(child.path);
                    
                    return (
                      <button
                        key={child.id}
                        onClick={() => handleNavigation(child.path)}
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

      {/* User Profile Section */}
      <div className="h-16 border-t border-gray-200 bg-white">
        <div className="flex items-center px-4 h-full gap-3">
          {/* User Avatar */}
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
};

export default Sidebar;
