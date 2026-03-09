// Layout Utilities - Dynamic sidebar navigation based on user PERMISSIONS
// This module filters navigation based on each user's specific permissions from backend

import type { User, Permission } from '../../contexts/AuthContext';

// Navigation item interface
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  // Resource name in backend (e.g., 'employees', 'departments', 'smart parking')
  resource?: string;
  // Action required to see this item (e.g., 'read:employees')
  requiredAction?: string;
  children?: NavItem[];
}

// All available navigation items for the application
// Each item maps to a backend resource and action
// Parent items (with children) become dropdowns
export const NAVIGATION_CONFIG: NavItem[] = [
  // Dashboard - standalone (no dropdown)
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'FiHome',
  },
  
  // Admin System - dropdown menu
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin/dashboard', // Default to first child
    icon: 'FiSettings',
    children: [
      { id: 'admin-dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: 'FiHome', resource: 'admin', requiredAction: 'read:admin' },
      { id: 'departments', label: 'Departments', path: '/admin/departments', icon: 'FiGrid', resource: 'departments', requiredAction: 'read:departments' },
      { id: 'employees', label: 'Employees', path: '/admin/employees', icon: 'FiUsers', resource: 'employees', requiredAction: 'read:employees' },
      { id: 'user-mgmt', label: 'User Management', path: '/admin/user-management', icon: 'FiUserCheck', resource: 'user_management', requiredAction: 'read:user_management' },
      { id: 'roles-mgmt', label: 'Roles Management', path: '/admin/roles-management', icon: 'FiShield', resource: 'roles_management', requiredAction: 'read:roles_management' },
    ],
  },
  
  // Smart Parking System - dropdown menu
  {
    id: 'smartParking',
    label: 'Smart Parking',
    path: '/smart-parking/dashboard',
    icon: 'FiTruck',
    children: [
      { id: 'parking-dashboard', label: 'Dashboard', path: '/smart-parking/dashboard', icon: 'FiHome', resource: 'smart parking', requiredAction: 'read:smart parking' },
      { id: 'parking-checkin', label: 'Check In', path: '/smart-parking/check-in', icon: 'FiLogIn', resource: 'smart parking', requiredAction: 'create:smart parking' },
      { id: 'parking-checkout', label: 'Check Out', path: '/smart-parking/check-out', icon: 'FiLogOut', resource: 'smart parking', requiredAction: 'update:smart parking' },
      { id: 'parking-records', label: 'Records', path: '/smart-parking/records', icon: 'FiList', resource: 'smart parking', requiredAction: 'read:smart parking' },
      { id: 'parking-reports', label: 'Reports', path: '/smart-parking/reports', icon: 'FiBarChart', resource: 'smart parking', requiredAction: 'read:smart parking' },
    ],
  },
  
  // Service Delivery System - dropdown menu
  {
    id: 'serviceDelivery',
    label: 'Service Delivery',
    path: '/service-delivery/dashboard',
    icon: 'FiClipboard',
    children: [
      { id: 'service-dashboard', label: 'Dashboard', path: '/service-delivery/dashboard', icon: 'FiHome', resource: 'service delivery', requiredAction: 'read:service delivery' },
      { id: 'service-visitors', label: 'Visitors', path: '/service-delivery/visitors', icon: 'FiUsers', resource: 'service delivery', requiredAction: 'read:service delivery' },
      { id: 'service-checkin', label: 'Check In', path: '/service-delivery/check-in', icon: 'FiLogIn', resource: 'service delivery', requiredAction: 'create:service delivery' },
      { id: 'service-checkout', label: 'Check Out', path: '/service-delivery/check-out', icon: 'FiLogOut', resource: 'service delivery', requiredAction: 'update:service delivery' },
      { id: 'service-department-flow', label: 'Department Flow', path: '/service-delivery/department-flow', icon: 'FiArrowRight', resource: 'service delivery', requiredAction: 'read:service delivery' },
    ],
  },
  
  // Profile - standalone
  {
    id: 'profile',
    label: 'Profile',
    path: '/profile',
    icon: 'FiUser',
  },
  
  // Reports - standalone
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'FiBarChart',
    resource: 'reports',
    requiredAction: 'read:reports',
  },
  
  // Settings - standalone
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: 'FiSettings',
    resource: 'settings',
    requiredAction: 'read:settings',
  },
];

// Convert user permissions to a Set for fast lookup
const buildPermissionSet = (permissions: Permission[] | undefined): Set<string> => {
  const permSet = new Set<string>();
  
  if (!permissions || !Array.isArray(permissions)) {
    return permSet;
  }
  
  for (const perm of permissions) {
    if (perm.resource && perm.actions) {
      for (const action of perm.actions) {
        // Store as "resource:action" format
        permSet.add(`${perm.resource.toLowerCase()}:${action.toLowerCase()}`);
        // Also store just the resource for "has any access" checks
        permSet.add(perm.resource.toLowerCase());
      }
    }
  }
  
  return permSet;
};

// Check if user has permission to view a nav item
const hasAccessToNavItem = (item: NavItem, permissionSet: Set<string>): boolean => {
  // If no specific permission required, allow access
  if (!item.resource && !item.requiredAction) {
    return true;
  }
  
  // If resource is specified but no action, check if user has any access to that resource
  if (item.resource && !item.requiredAction) {
    return permissionSet.has(item.resource.toLowerCase());
  }
  
  // Check for specific resource:action permission
  if (item.resource && item.requiredAction) {
    const permKey = `${item.resource.toLowerCase()}:${item.requiredAction.toLowerCase()}`;
    return permissionSet.has(permKey);
  }
  
  return false;
};

// Get navigation items based on user's actual permissions from backend
export const getNavigationByPermissions = (user: User | null): NavItem[] => {
  // If no user, return empty (should be protected by auth)
  if (!user) {
    return [];
  }
  
  // Get user's permissions from the backend response
  const userPermissions = user.permissions;
  
  // Build permission set for fast lookup
  const permissionSet = buildPermissionSet(userPermissions);
  
  // Get user role
  const userRole = user.role?.toLowerCase() || '';
  
  // System admins and admins get full access (also check for empty permissions as fallback)
  const adminRoles = ['system_admin', 'system admin', 'admin', 'system', 'it', 'super_admin', 'superadmin'];
  const isAdmin = adminRoles.includes(userRole);
  const hasPermissions = userPermissions && userPermissions.length > 0;
  
  // If user is admin OR has no permissions set, show all navigation (for development/fallback)
  if (isAdmin || !hasPermissions) {
    console.log('[Layout] Showing full navigation - Role:', userRole, 'Has permissions:', hasPermissions);
    
    // For admin, modify navigation to remove dashboard from other systems
    if (isAdmin) {
      return NAVIGATION_CONFIG.map(item => {
        // Skip the standalone dashboard at top level for admin
        if (item.id === 'dashboard') {
          return null;
        }
        
        // For Smart Parking and Service Delivery, remove Dashboard child
        if ((item.id === 'smartParking' || item.id === 'serviceDelivery') && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.id !== 'parking-dashboard' && child.id !== 'service-dashboard'
            ),
          };
        }
        
        return item;
      }).filter(Boolean) as NavItem[];
    }
    
    return NAVIGATION_CONFIG;
  }
  
  // Filter navigation based on user permissions
  const filteredNav: NavItem[] = [];
  
  for (const item of NAVIGATION_CONFIG) {
    // Check if user has access to this item
    const hasAccess = hasAccessToNavItem(item, permissionSet);
    
    if (hasAccess) {
      // If item has children, filter them too
      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children.filter(child => 
          hasAccessToNavItem(child, permissionSet)
        );
        
        // Only add parent if it has accessible children
        if (filteredChildren.length > 0) {
          filteredNav.push({
            ...item,
            children: filteredChildren,
          });
        }
      } else {
        // Add item without children
        filteredNav.push(item);
      }
    }
  }
  
  return filteredNav;
};

// Convert navigation to sidebar link format (with dropdown info)
export interface SidebarLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  isParent: boolean;         // true if this is a dropdown header
  isExpandable?: boolean;    // true if this has children (dropdown) - optional for compatibility
  parentId?: string;
  children?: SidebarLink[]; // Child if this is a dropdown
}

export const toSidebarLinks = (navigation: NavItem[]): SidebarLink[] => {
  const links: SidebarLink[] = [];
  
  for (const item of navigation) {
    // Check if this item has children (is a dropdown)
    const isExpandable = !!(item.children && item.children.length > 0);
    
    // Add parent as dropdown header (not clickable, just expandable)
    links.push({
      id: item.id,
      name: item.label,
      path: item.path, // Default path when clicking the dropdown
      icon: item.icon,
      isParent: true,
      isExpandable: isExpandable,
      children: isExpandable ? item.children?.map(child => ({
        id: child.id,
        name: child.label,
        path: child.path,
        icon: child.icon,
        isParent: false,
        isExpandable: false,
        parentId: item.id,
      })) : undefined,
    });
  }
  
  return links;
};

// Get current system from path
export const getCurrentSystemFromPath = (pathname: string): string => {
  const path = pathname.toLowerCase();
  
  if (path.includes('/admin')) return 'Admin';
  if (path.includes('/smart-parking') || path.includes('/parking')) return 'Smart Parking';
  if (path.includes('/service-delivery') || path.includes('/service')) return 'Service Delivery';
  if (path.includes('/dashboard') || path === '/') return 'Dashboard';
  if (path.includes('/profile')) return 'Profile';
  if (path.includes('/reports')) return 'Reports';
  if (path.includes('/settings')) return 'Settings';
  
  return 'Dashboard';
};

// Hook to get navigation for current user based on their permissions
export const useUserNavigation = () => {
  // This will be called from MainLayout which has access to AuthContext
  // We return a function that accepts user as parameter
  return {
    getNavigation: (user: User | null) => getNavigationByPermissions(user),
    toSidebarLinks,
  };
};

export default {
  NAVIGATION_CONFIG,
  getNavigationByPermissions,
  toSidebarLinks,
  getCurrentSystemFromPath,
  useUserNavigation,
};
