// Layout Utilities - Dynamic sidebar navigation based on user PERMISSIONS from backend
// This module filters navigation based on each user's specific permissions from backend
// NO hardcoded navigation - everything is derived from user's permissions

import type { User, Permission } from '../../contexts/AuthContext';

// ==================== Permission Helpers ====================

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

// Check if user has permission for a specific resource and action
export const hasPermission = (user: User | null, resource: string, action?: string): boolean => {
  if (!user) return false;
  
  const permissionSet = buildPermissionSet(user.permissions);
  const normalizedResource = resource.toLowerCase();
  
  // If no specific action, check if user has any access to that resource
  if (!action) {
    return permissionSet.has(normalizedResource);
  }
  
  // Check for specific resource:action permission
  const permKey = `${normalizedResource}:${action.toLowerCase()}`;
  return permissionSet.has(permKey);
};

// Check if user has admin access (based on role from backend)
export const isAdminRole = (role: string | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized.includes('admin') || normalized.includes('system');
};

// ==================== Dynamic Navigation ====================

// Navigation item interface - resource/action reference backend permissions
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  // Resource name in backend (e.g., 'employees', 'departments')
  resource?: string;
  // Action required to see this item (e.g., 'read:employees')
  requiredAction?: string;
  children?: NavItem[];
}

// Build navigation dynamically based on user permissions from backend
export const getNavigationByPermissions = (user: User | null): NavItem[] => {
  // If no user, return empty (should be protected by auth)
  if (!user) {
    return [];
  }
  
  // Get user's permissions from the backend response
  const userPermissions = user.permissions;
  
  // Build permission set for fast lookup
  const permissionSet = buildPermissionSet(userPermissions);
  
  // Get user role from backend
  const userRole = user.role?.toLowerCase() || '';
  
  // Check if user is admin (from backend role)
  const isAdmin = isAdminRole(userRole);
  const hasPermissions = userPermissions && userPermissions.length > 0;
  
  // If no permissions set yet, return minimal navigation
  if (!hasPermissions) {
    console.log('[Layout] No permissions from backend, showing minimal nav');
    return getMinimalNavigation(userRole);
  }
  
  // Build dynamic navigation based on user's actual permissions
  const navigation: NavItem[] = [];
  
  // Add Dashboard for non-admin users only (admin has Dashboard inside Admin dropdown)
  if (!isAdmin) {
    navigation.push({
      id: 'dashboard',
      label: 'Dashboard',
      path: getDashboardRoute(userRole, user.departmentName || user.department_name),
      icon: 'FiHome',
    });
  }
  
  // Check for Admin system permissions
  const hasAdminAccess = hasPermission(user, 'admin') || hasPermission(user, 'departments') || 
                        hasPermission(user, 'employees') || hasPermission(user, 'roles_management');
  if (hasAdminAccess || isAdmin) {
    const adminChildren: NavItem[] = [];
    
    if (hasPermission(user, 'admin') || isAdmin) {
      adminChildren.push({ id: 'admin-dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: 'FiHome' });
    }
    if (hasPermission(user, 'departments') || isAdmin) {
      adminChildren.push({ id: 'departments', label: 'Departments', path: '/admin/departments', icon: 'FiGrid', resource: 'departments', requiredAction: 'read:departments' });
    }
    if (hasPermission(user, 'employees') || isAdmin) {
      adminChildren.push({ id: 'employees', label: 'Employees', path: '/admin/employees', icon: 'FiUsers', resource: 'employees', requiredAction: 'read:employees' });
    }
    if (hasPermission(user, 'roles_management') || isAdmin) {
      adminChildren.push({ id: 'roles-mgmt', label: 'Roles Management', path: '/admin/roles-management', icon: 'FiShield', resource: 'roles_management', requiredAction: 'read:roles_management' });
    } 
    if ((hasPermission(user, 'admin') || isAdmin) && (hasPermission(user, 'user_management') || isAdmin)) {
      adminChildren.push({ id: 'user-mgmt', label: 'User Management', path: '/admin/user-management', icon: 'FiUser', resource: 'user_management', requiredAction: 'read:user_management' });
    } 
    
    if (adminChildren.length > 0) {
      navigation.push({
        id: 'admin',
        label: 'Admin',
        path: '/admin/dashboard',
        icon: 'FiSettings',
        children: adminChildren,
      });
    }
  }
  
  // Check for Smart Parking permissions
  const hasParkingAccess = hasPermission(user, 'smart parking') || hasPermission(user, 'parking');
  if (hasParkingAccess || isAdmin) {
    const parkingChildren: NavItem[] = [];
    
    if (hasPermission(user, 'smart parking', 'read') || isAdmin) {
      parkingChildren.push({ id: 'parking-dashboard', label: 'Dashboard', path: '/smart-parking/dashboard', icon: 'FiHome', resource: 'smart parking', requiredAction: 'read:smart parking' });
    }
    if (hasPermission(user, 'smart parking', 'create') || isAdmin) {
      parkingChildren.push({ id: 'parking-checkin', label: 'Check In', path: '/smart-parking/check-in', icon: 'FiLogIn', resource: 'smart parking', requiredAction: 'create:smart parking' });
    }
    if (hasPermission(user, 'smart parking', 'update') || isAdmin) {
      parkingChildren.push({ id: 'parking-checkout', label: 'Check Out', path: '/smart-parking/check-out', icon: 'FiLogOut', resource: 'smart parking', requiredAction: 'update:smart parking' });
    }
    
    if (parkingChildren.length > 0) {
      navigation.push({
        id: 'smartParking',
        label: 'Smart Parking',
        path: '/smart-parking/dashboard',
        icon: 'FiTruck',
        children: parkingChildren,
      });
    }
  }
  
  // Check for Service Delivery permissions
  const hasServiceAccess = hasPermission(user, 'service delivery');
  if (hasServiceAccess || isAdmin) {
    const serviceChildren: NavItem[] = [];
    
    if (hasPermission(user, 'service delivery', 'read') || isAdmin) {
      serviceChildren.push({ id: 'service-dashboard', label: 'Dashboard', path: '/service-delivery/dashboard', icon: 'FiHome', resource: 'service delivery', requiredAction: 'read:service delivery' });
    }
    if (hasPermission(user, 'service delivery', 'create') || isAdmin) {
      serviceChildren.push({ id: 'service-checkin', label: 'Check In', path: '/service-delivery/check-in', icon: 'FiLogIn', resource: 'service delivery', requiredAction: 'create:service delivery' });
    }
    if (hasPermission(user, 'service delivery', 'update') || isAdmin) {
      serviceChildren.push({ id: 'service-checkout', label: 'Check Out', path: '/service-delivery/check-out', icon: 'FiLogOut', resource: 'service delivery', requiredAction: 'update:service delivery' });
    }
    
    if (serviceChildren.length > 0) {
      navigation.push({
        id: 'serviceDelivery',
        label: 'Service Delivery',
        path: '/service-delivery/dashboard',
        icon: 'FiClipboard',
        children: serviceChildren,
      });
    }
  }
  
  console.log('[Layout] Generated dynamic navigation for role:', userRole, 'Items:', navigation.length);
  return navigation;
};

// Get minimal navigation for users without permissions yet
const getMinimalNavigation = (role: string): NavItem[] => {
  const nav: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/under-development',
      icon: 'FiHome',
    },
  ];
  
  // If admin, show admin link
  if (isAdminRole(role)) {
    nav.splice(1, 0, {
      id: 'admin',
      label: 'Admin',
      path: '/admin/dashboard',
      icon: 'FiSettings',
    });
  }
  
  return nav;
};

// ==================== Sidebar Link Conversion ====================

export interface SidebarLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  isParent: boolean;
  isExpandable?: boolean;
  parentId?: string;
  children?: SidebarLink[];
}

// Convert navigation to sidebar link format
export const toSidebarLinks = (navigation: NavItem[]): SidebarLink[] => {
  const links: SidebarLink[] = [];
  
  for (const item of navigation) {
    const isExpandable = !!(item.children && item.children.length > 0);
    
    links.push({
      id: item.id,
      name: item.label,
      path: item.path,
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

// ==================== Route Helpers ====================

// Get current system from path (derived from URL, not hardcoded)
export const getCurrentSystemFromPath = (pathname: string): string => {
  const path = pathname.toLowerCase();
  
  if (path.includes('/admin')) return 'Admin';
  if (path.includes('/smart-parking') || path.includes('/parking')) return 'Smart Parking';
  if (path.includes('/service-delivery') || path.includes('/service')) return 'Service Delivery';
  if (path.includes('/dashboard') || path === '/') return 'Dashboard';
  if (path.includes('/profile')) return 'Profile';
  
  return 'Dashboard';
};

// Get dashboard route based on user's role from backend
export const getDashboardRoute = (role: string | undefined, departmentName?: string): string => {
  console.log('[getDashboardRoute] Determining route for role:', role, 'dept:', departmentName);
  
  // If no role, go to under-development
  if (!role) {
    return '/under-development';
  }
  
  const normalizedRole = role.toLowerCase().trim();
  
  // If admin/system role, go to admin dashboard
  if (normalizedRole.includes('admin') || normalizedRole.includes('system')) {
    return '/admin/dashboard';
  }
  
  // Check department name for department-specific routing
  if (departmentName) {
    const dept = departmentName.toLowerCase();
    
    if (dept.includes('it') || dept.includes('finance') || dept.includes('operations')) {
      return '/smart-parking/dashboard';
    }
    if (dept.includes('hr') || dept.includes('human') || dept.includes('legal')) {
      return '/service-delivery/dashboard';
    }
  }
  
  // Default - try to determine from role
  if (normalizedRole.includes('parking') || normalizedRole.includes('it')) {
    return '/smart-parking/dashboard';
  }
  if (normalizedRole.includes('service') || normalizedRole.includes('hr')) {
    return '/service-delivery/dashboard';
  }
  
  // Fallback to under-development
  return '/under-development';
};

// Get user department (supports both departmentName and department_name from backend)
export const getUserDepartment = (user: any): string => {
  if (!user) return '';
  return user.departmentName || user.department_name || '';
};

// Get user's available systems based on role (for SystemSelector page)
// Returns list of systems user can access
export const getUserSystems = (user: any): Array<{ id: string; name: string; path: string; icon: string }> => {
  if (!user) return [];
  
  const userRole = (user.role || '').toLowerCase().trim();
  const isAdmin = isAdminRole(userRole);
  const hasPermissions = user.permissions && user.permissions.length > 0;
  
  // If admin, show all systems
  if (isAdmin) {
    return [
      { id: 'admin', name: 'Admin', path: '/admin/dashboard', icon: 'FiSettings' },
      { id: 'parking', name: 'Smart Parking', path: '/smart-parking/dashboard', icon: 'FiTruck' },
      { id: 'service', name: 'Service Delivery', path: '/service-delivery/dashboard', icon: 'FiClipboard' },
    ];
  }
  
  // If no permissions yet, return minimal
  if (!hasPermissions) {
    return [
      { id: 'dashboard', name: 'Dashboard', path: '/under-development', icon: 'FiHome' },
    ];
  }
  
  // Build systems based on permissions
  const systems: Array<{ id: string; name: string; path: string; icon: string }> = [];
  
  // Check each permission
  const hasParking = hasPermission(user, 'smart parking') || hasPermission(user, 'parking');
  const hasService = hasPermission(user, 'service delivery');
  const hasAdmin = hasPermission(user, 'admin') || hasPermission(user, 'departments') || hasPermission(user, 'employees');
  
  if (hasAdmin || hasParking || hasService) {
    systems.push({ id: 'dashboard', name: 'Dashboard', path: getDashboardRoute(userRole, getUserDepartment(user)), icon: 'FiHome' });
  }
  if (hasAdmin) {
    systems.push({ id: 'admin', name: 'Admin', path: '/admin/dashboard', icon: 'FiSettings' });
  }
  if (hasParking) {
    systems.push({ id: 'parking', name: 'Smart Parking', path: '/smart-parking/dashboard', icon: 'FiTruck' });
  }
  if (hasService) {
    systems.push({ id: 'service', name: 'Service Delivery', path: '/service-delivery/dashboard', icon: 'FiClipboard' });
  }
  
  return systems.length > 0 ? systems : [{ id: 'dashboard', name: 'Dashboard', path: '/under-development', icon: 'FiHome' }];
};

// Check if department has a dedicated dashboard
export const hasDedicatedDashboard = (user: any): boolean => {
  const department = getUserDepartment(user);
  return department.toLowerCase().includes('system admin');
};

// ==================== Legacy Support (Deprecated) ====================

// DEPRECATED: Use getNavigationByPermissions instead
// Kept for backward compatibility with older components
export const useUserNavigation = () => {
  return {
    getNavigation: (user: User | null) => getNavigationByPermissions(user),
    toSidebarLinks,
  };
};

export default {
  hasPermission,
  isAdminRole,
  getNavigationByPermissions,
  toSidebarLinks,
  getCurrentSystemFromPath,
  getDashboardRoute,
  getUserDepartment,
  getUserSystems,
  hasDedicatedDashboard,
  useUserNavigation,
};
