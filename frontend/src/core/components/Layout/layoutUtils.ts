import { useNavigate } from 'react-router-dom';
import type { User, Permission } from '../../contexts/AuthContext';


// ==================== Role Slug Helpers ====================

// Convert a role name to a URL-friendly slug prefix
export const getRoleSlug = (role: string | undefined): string => {
  if (!role) return 'user';
  const normalized = role.toLowerCase().trim();

  
  if (normalized === 'system admin' || (normalized.includes('admin') && normalized.includes('system'))) return 'system-admin';
  if (normalized.includes('receptionist')) return 'receptionist';
  if (normalized.includes('department manager') || normalized.includes('department head') || normalized.includes('head of department') || normalized.includes('director')) return 'department-manager';
  if (normalized.includes('gate') && normalized.includes('vehicle')) return 'gate-officer';
  if ((normalized.includes('manager') || normalized.includes('head')) && !normalized.includes('receptionist')) return 'department-manager';
  if (normalized.includes('employee') || normalized.includes('staff') || normalized.includes('officer') || normalized.includes('clerk')) return 'employee';
  if (normalized.includes('admin')) return 'system-admin';
  

  // Fallback: convert to kebab-case
  return normalized.replace(/\s+/g, '-');
};

// Format a role name into a human-readable title
export const formatRoleName = (role: string | undefined): string => {
  if (!role) return 'User';
  const normalized = role.toLowerCase().trim();

  if (normalized === 'system admin' || (normalized.includes('admin') && normalized.includes('system'))) return 'System Admin';
  if (normalized.includes('receptionist')) return 'Receptionist';
  if (normalized.includes('department manager') || normalized.includes('department head') || normalized.includes('head of department')) return 'Department Manager';
  if (normalized.includes('director')) return 'Director';
  if (normalized.includes('gate') && normalized.includes('vehicle')) return 'Gate Officer';
  if (normalized.includes('manager')) return 'Manager';
  if (normalized.includes('employee')) return 'Employee';
  if (normalized.includes('staff')) return 'Staff';

  // Capitalize each word as fallback
  return role.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// ==================== Permission Helpers ====================

const buildPermissionSet = (permissions: Permission[] | undefined): Set<string> => {
  const permSet = new Set<string>();
  if (!permissions || !Array.isArray(permissions)) return permSet;
  for (const perm of permissions) {
    const resource = perm.resource || perm.resource_name;
    if (resource && perm.actions) {
      for (const action of perm.actions) {
        const actionType = typeof action === 'string' ? action : action.action_type;
        if (actionType) {
          permSet.add(`${resource.toLowerCase()}:${actionType.toLowerCase()}`);
          permSet.add(resource.toLowerCase());
        }
      }
    }
  }
  return permSet;
};

export const hasPermission = (user: User | null, resource: string, action?: string): boolean => {
  if (!user) return false;
  const permissionSet = buildPermissionSet(user.permissions);
  const normalizedResource = resource.toLowerCase();
  if (!action) return permissionSet.has(normalizedResource);
  return permissionSet.has(`${normalizedResource}:${action.toLowerCase()}`);
};

export const isAdminRole = (role: string | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "system admin";
};

// ==================== Dynamic Navigation ====================

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  resource?: string;
  requiredAction?: string;
  children?: NavItem[];
}

export const getNavigationByPermissions = (user: User | null): NavItem[] => {
  if (!user) return [];

  const userPermissions = user.permissions;
  const userRole = user.role?.toLowerCase() || '';
  const isAdmin = isAdminRole(userRole);
  const slug = getRoleSlug(user.role);

  // RECEPTIONIST INTERCEPTOR
  if (userRole.includes('receptionist')) {
    return [
      { id: 'dashboard', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiHome' },
      { id: 'assigned-visitors', label: 'Assigned Visitors', path: `/${slug}/dashboard?tab=visitors`, icon: 'FiUsers' }
    ];
  }

  // EMPLOYEE INTERCEPTOR
  if (userRole.includes('employee') || userRole.includes('staff')) {
    return [
      { id: 'dashboard', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiGrid' },
      { id: 'tasks', label: 'Task Manager', path: `/${slug}/dashboard?tab=tasks`, icon: 'FiClipboard' },
      { id: 'performance', label: 'Performance Analytics', path: `/${slug}/dashboard?tab=performance`, icon: 'FiBarChart2' },
      { id: 'history', label: 'Service History', path: `/${slug}/dashboard?tab=history`, icon: 'FiFileText' },
      { id: 'queue', label: 'Department Queue', path: `/${slug}/dashboard?tab=queue`, icon: 'FiList' },
    ];
  }

  // MANAGER INTERCEPTOR
  if (userRole.includes('department manager') || userRole.includes('department head') ||
      userRole.includes('head of department') || userRole.includes('director')) {
    return [
      { id: 'dashboard', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiGrid' },
      {
        id: 'requests',
        label: 'Requests',
        path: `/${slug}/dashboard?tab=active-tasks`,
        icon: 'FiClipboard',
        children: [
          { id: 'active-tasks', label: 'Active Tasks', path: `/${slug}/dashboard?tab=active-tasks`, icon: 'FiActivity' },
          { id: 'completed-requests', label: 'Completed Requests', path: `/${slug}/dashboard?tab=completed-requests`, icon: 'FiCheck' }
        ]
      },
      { id: 'employees', label: 'Employee Management', path: `/${slug}/dashboard?tab=employees`, icon: 'FiUsers' },
      { id: 'departments', label: 'Department Management', path: `/${slug}/dashboard?tab=departments`, icon: 'FiLayers' },
      { id: 'feedback', label: 'Feedback & Analytics', path: `/${slug}/dashboard?tab=feedback`, icon: 'FiMessageSquare' }
    ];
  }

  // GATE AND VEHICLE REGISTRAR INTERCEPTOR
  if (userRole.includes('gate') && userRole.includes('vehicle')) {
    return [
      { id: 'overview', label: 'Overview', path: `/${slug}/dashboard`, icon: 'FiHome' },
      {
        id: 'checkin',
        label: 'Check-in',
        path: `/${slug}/checkin-vehicle`,
        icon: 'FiLogIn',
        children: [
          { id: 'checkin-vehicle', label: 'Vehicle', path: `/${slug}/checkin-vehicle`, icon: 'FiTruck' },
          { id: 'checkin-person', label: 'Person', path: `/${slug}/checkin-person`, icon: 'FiUser' }
        ]
      },
      {
        id: 'checkout',
        label: 'Check-out',
        path: `/${slug}/checkout-vehicle`,
        icon: 'FiLogOut',
        children: [
          { id: 'checkout-vehicle', label: 'Vehicle', path: `/${slug}/checkout-vehicle`, icon: 'FiTruck' },
          { id: 'checkout-person', label: 'Person', path: `/${slug}/checkout-person`, icon: 'FiUser' }
        ]
      }
    ];
  }

  // Generic manager/head
  if ((userRole.includes('manager') || userRole.includes('head')) && !userRole.includes('receptionist')) {
    return [
      { id: 'dashboard', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiGrid' },
      { id: 'status', label: 'Service Status', path: `/${slug}/dashboard?tab=status`, icon: 'FiClock' },
      { id: 'employees', label: 'Employee Management', path: `/${slug}/dashboard?tab=employees`, icon: 'FiUsers' },
      { id: 'availability', label: 'Dept. Availability', path: `/${slug}/dashboard?tab=availability`, icon: 'FiCheckCircle' },
      { id: 'reports', label: 'Reports', path: `/${slug}/dashboard?tab=reports`, icon: 'FiFile' }
    ];
  }

  // Mayor Role Interceptor 

  if(userRole.includes('mayor')) {

    // only show all dashboards from admin and overview page without any children links with analytics and feedback links

    return [
      { id: 'mayor-dashboadr', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiHome' },
      { id: 'mayor-activities', label: 'Activities', path: `/${slug}/overview`, icon: 'FiBarChart2' },
      { id: 'service-dashboard', label: 'Service Delivery Dashboard', path: `/${slug}/service-delivery/dashboard`, icon: 'FiClipboard' },
      { id: 'service-feedback', label: 'Feedback Analysis', path: `/${slug}/service-delivery/feedback`, icon: 'FiMessageSquare' },
    ];
  }

  // if not the user is not an admin it means the role not exists redirect to under by using useNavigate

  if(!isAdmin) {
    return [
      {
        id: 'unknown',
        label: 'Unknown Role',
        path: `/${slug}/Unknown-user`,
        icon: 'FiAlertTriangle'
      }
    ]
  }

  // amin routes

  const navigation: NavItem[] = [];

  const hasAdminAccess = hasPermission(user, 'admin') || hasPermission(user, 'departments') ||
                        hasPermission(user, 'employees') || hasPermission(user, 'roles_management');
  if (hasAdminAccess || isAdmin) {
    const adminChildren: NavItem[] = [];
    if (hasPermission(user, 'admin') || isAdmin)
      adminChildren.push({ id: 'admin-dashboard', label: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiHome' });
    if (hasPermission(user, 'departments') || isAdmin)
      adminChildren.push({ id: 'departments', label: 'Departments', path: `/${slug}/departments`, icon: 'FiGrid' });
    if (hasPermission(user, 'employees') || isAdmin)
      adminChildren.push({ id: 'employees', label: 'Employees', path: `/${slug}/employees`, icon: 'FiUsers' });
    if (hasPermission(user, 'roles_management') || isAdmin)
      adminChildren.push({ id: 'roles-mgmt', label: 'Roles Management', path: `/${slug}/roles-management`, icon: 'FiShield' });
    if ((hasPermission(user, 'admin') || isAdmin) && (hasPermission(user, 'user_management') || isAdmin))
      adminChildren.push({ id: 'user-mgmt', label: 'User Management', path: `/${slug}/user-management`, icon: 'FiUser' });
    if (hasPermission(user, 'admin') || isAdmin)
      adminChildren.push({ id: 'system-audit', label: 'System Audit', path: `/${slug}/system-audit`, icon: 'FiActivity' });
    if (adminChildren.length > 0) {
      navigation.push({ id: 'admin', label: 'Admin', path: `/${slug}/dashboard`, icon: 'FiSettings', children: adminChildren });
    }
  }

  const hasParkingAccess = hasPermission(user, 'smart parking') || hasPermission(user, 'parking');
  if (hasParkingAccess || isAdmin) {
    const parkingChildren: NavItem[] = [];
    if (hasPermission(user, 'smart parking', 'read') || isAdmin)
      parkingChildren.push({ id: 'parking-dashboard', label: 'Dashboard', path: `/${slug}/smart-parking`, icon: 'FiHome' });
    if (hasPermission(user, 'smart parking', 'read') || isAdmin)
      parkingChildren.push({ id: 'parking-reservation', label: 'Reservation', path: `/${slug}/smart-parking/reservation`, icon: 'FiCalendar' });
    if (parkingChildren.length > 0) {
      navigation.push({ id: 'smartParking', label: 'Smart Parking', path: `/${slug}/smart-parking`, icon: 'FiTruck', children: parkingChildren });
    }
  }

  const hasServiceAccess = hasPermission(user, 'service delivery');
  if (hasServiceAccess || isAdmin) {
    const serviceChildren: NavItem[] = [];
    if (hasPermission(user, 'service delivery', 'read') || isAdmin)
      serviceChildren.push({ id: 'service-dashboard', label: 'Dashboard', path: `/${slug}/service-delivery/dashboard`, icon: 'FiHome' });
    if (hasPermission(user, 'service delivery', 'create') || isAdmin)
      serviceChildren.push({ id: 'service-checkin-checkout', label: 'Check-In/Check-Out', path: `/${slug}/service-delivery/checkin-checkout`, icon: 'FiLogIn' });
    if (hasPermission(user, 'service delivery', 'read') || isAdmin)
      serviceChildren.push({ id: 'service-analytics', label: 'Analytics', path: `/${slug}/service-delivery/analytics`, icon: 'FiBarChart2' });
    if (hasPermission(user, 'service delivery', 'read') || isAdmin)
      serviceChildren.push({ id: 'service-feedback', label: 'Feedback', path: `/${slug}/service-delivery/feedback`, icon: 'FiMessageSquare' });
    if (serviceChildren.length > 0) {
      navigation.push({ id: 'serviceDelivery', label: 'Service Delivery', path: `/${slug}/service-delivery/dashboard`, icon: 'FiClipboard', children: serviceChildren });
    }
  }

  console.log('[Layout] Generated dynamic navigation for role:', userRole, 'Items:', navigation.length);
  return navigation;
};

const getRoleSelectionNavigation = (_role: string): NavItem[] => {
  return [
    { id: 'overview', label: 'Overview', path: '/system-admin/overview', icon: 'FiBarChart2' },
    {
      id: 'receptionist', label: 'Receptionist', path: '/receptionist/dashboard', icon: 'FiHome',
      children: [
        { id: 'receptionist-dashboard', label: 'Dashboard', path: '/receptionist/dashboard', icon: 'FiHome' },
        { id: 'receptionist-assigned-visitors', label: 'Assigned Visitors', path: '/receptionist/dashboard?tab=visitors', icon: 'FiUsers' },
      ]
    },
    {
      id: 'employee', label: 'Employee', path: '/employee/dashboard', icon: 'FiUsers',
      children: [
        { id: 'employee-dashboard', label: 'Dashboard', path: '/employee/dashboard', icon: 'FiGrid' },
        { id: 'employee-performance', label: 'Performance Analytics', path: '/employee/dashboard?tab=performance', icon: 'FiBarChart2' },
        { id: 'employee-history', label: 'Service History', path: '/employee/dashboard?tab=history', icon: 'FiFileText' },
        { id: 'employee-queue', label: 'Department Queue', path: '/employee/dashboard?tab=queue', icon: 'FiList' },
      ]
    },
    {
      id: 'department-manager', label: 'Department Manager', path: '/department-manager/dashboard', icon: 'HiOutlineOfficeBuilding',
      children: [
        { id: 'dept-manager-dashboard', label: 'Dashboard', path: '/department-manager/dashboard', icon: 'FiGrid' },
        { id: 'dept-manager-active-tasks', label: 'Active Tasks', path: '/department-manager/dashboard?tab=active-tasks', icon: 'FiActivity' },
        { id: 'dept-manager-completed-requests', label: 'Completed Requests', path: '/department-manager/dashboard?tab=completed-requests', icon: 'FiCheck' },
        { id: 'dept-manager-employees', label: 'Employee Management', path: '/department-manager/dashboard?tab=employees', icon: 'FiUsers' },
        { id: 'dept-manager-departments', label: 'Department Management', path: '/department-manager/dashboard?tab=departments', icon: 'FiLayers' },
        { id: 'dept-manager-feedback', label: 'Feedback & Analytics', path: '/department-manager/dashboard?tab=feedback', icon: 'FiMessageSquare' },
      ]
    },
    {
      id: 'gate-officer', label: 'Gate Officer', path: '/gate-officer/dashboard', icon: 'FiTruck',
      children: [
        { id: 'gate-overview', label: 'Overview', path: '/gate-officer/dashboard', icon: 'FiHome' },
        { id: 'gate-checkin-vehicle', label: 'Check-in Vehicle', path: '/gate-officer/checkin-vehicle', icon: 'FiTruck' },
        { id: 'gate-checkin-person', label: 'Check-in Person', path: '/gate-officer/checkin-person', icon: 'FiUser' },
        { id: 'gate-checkout-vehicle', label: 'Check-out Vehicle', path: '/gate-officer/checkout-vehicle', icon: 'FiTruck' },
        { id: 'gate-checkout-person', label: 'Check-out Person', path: '/gate-officer/checkout-person', icon: 'FiUser' },
      ]
    },
    {
      id: 'admin', label: 'Admin', path: '/system-admin/dashboard', icon: 'FiSettings',
      children: [
        { id: 'admin-dashboard', label: 'Dashboard', path: '/system-admin/dashboard', icon: 'FiHome' },
        { id: 'admin-departments', label: 'Departments', path: '/system-admin/departments', icon: 'FiGrid' },
        { id: 'admin-employees', label: 'Employees', path: '/system-admin/employees', icon: 'FiUsers' },
        { id: 'admin-user-management', label: 'User Management', path: '/system-admin/user-management', icon: 'FiUser' },
        { id: 'admin-roles-management', label: 'Roles Management', path: '/system-admin/roles-management', icon: 'FiShield' },
      ]
    },
    {
      id: 'smart-parking', label: 'Smart Parking', path: '/system-admin/smart-parking', icon: 'FiTruck',
      children: [
        { id: 'parking-dashboard', label: 'Dashboard', path: '/system-admin/smart-parking', icon: 'FiHome' },
        { id: 'parking-reservation', label: 'Reservation', path: '/system-admin/smart-parking/reservation', icon: 'FiCalendar' },
      ]
    },
    {
      id: 'service-delivery', label: 'Service Delivery', path: '/system-admin/service-delivery/dashboard', icon: 'FiClipboard',
      children: [
        { id: 'service-dashboard', label: 'Dashboard', path: '/system-admin/service-delivery/dashboard', icon: 'FiHome' },
        { id: 'service-checkin-checkout', label: 'Check-In/Check-Out', path: '/system-admin/service-delivery/checkin-checkout', icon: 'FiLogIn' },
        { id: 'service-analytics', label: 'Analytics', path: '/system-admin/service-delivery/analytics', icon: 'FiBarChart2' },
        { id: 'service-feedback', label: 'Feedback', path: '/system-admin/service-delivery/feedback', icon: 'FiMessageSquare' },
      ]
    },
  ];
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
      isExpandable,
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

export const getCurrentSystemFromPath = (pathname: string): string => {
  return pathname;
};

// Get dashboard route based on user's role — returns role-slug based paths
export const getDashboardRoute = (role: string | undefined, _departmentName?: string): string => {
  console.log('[getDashboardRoute] Determining route for role:', role);
  if (!role) return '/under-development';

  const normalizedRole = role.toLowerCase().trim();
  const slug = getRoleSlug(role);
 
  if (normalizedRole.includes('receptionist')) return `/${slug}/dashboard`;
  if(normalizedRole.includes("event-manager")) return `/event-manager/rooms/all`;
  if (normalizedRole.includes('department manager') || normalizedRole.includes('department head') ||
      normalizedRole.includes('head of department') || normalizedRole.includes('director')) return `/${slug}/dashboard`;
  if ((normalizedRole.includes('manager') || normalizedRole.includes('head')) && !normalizedRole.includes('receptionist')) return `/${slug}/dashboard`;
  if (normalizedRole.includes('gate') && normalizedRole.includes('vehicle')) return `/${slug}/dashboard`;
  if (normalizedRole.includes('employee') || normalizedRole.includes('staff')) return `/${slug}/dashboard`;
  if (normalizedRole.includes('officer') || normalizedRole.includes('clerk')) return `/${slug}/dashboard`;
  if (normalizedRole.includes('admin') || normalizedRole.includes('system')) return `/${slug}/dashboard`;
  if (normalizedRole.includes('parking') || normalizedRole.includes('service') || normalizedRole.includes('hr')) return `/${slug}/dashboard`;

  return `/${slug}/dashboard`;
};

export const getUserDepartment = (user: any): string => {
  if (!user) return '';
  return user.departmentName || user.department_name || '';
};

export const getUserSystems = (user: any): Array<{ id: string; name: string; path: string; icon: string }> => {
  if (!user) return [];
  const userRole = (user.role || '').toLowerCase().trim();
  const isAdmin = isAdminRole(userRole);
  const hasPermissions = user.permissions && user.permissions.length > 0;
  const slug = getRoleSlug(user.role);

  if (isAdmin) {
    return [
      { id: 'admin', name: 'Admin', path: `/${slug}/dashboard`, icon: 'FiSettings' },
      { id: 'parking', name: 'Smart Parking', path: `/${slug}/smart-parking`, icon: 'FiTruck' },
      { id: 'service', name: 'Service Delivery', path: `/${slug}/service-delivery/dashboard`, icon: 'FiClipboard' },
    ];
  }
  if (!hasPermissions) {
    return [{ id: 'dashboard', name: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiHome' }];
  }

  const systems: Array<{ id: string; name: string; path: string; icon: string }> = [];
  const hasParking = hasPermission(user, 'smart parking') || hasPermission(user, 'parking');
  const hasService = hasPermission(user, 'service delivery');
  const hasAdmin = hasPermission(user, 'admin') || hasPermission(user, 'departments') || hasPermission(user, 'employees');

  if (hasAdmin || hasParking || hasService) {
    systems.push({ id: 'dashboard', name: 'Dashboard', path: getDashboardRoute(userRole, getUserDepartment(user)), icon: 'FiHome' });
  }
  if (hasAdmin) systems.push({ id: 'admin', name: 'Admin', path: `/${slug}/dashboard`, icon: 'FiSettings' });
  if (hasParking) systems.push({ id: 'parking', name: 'Smart Parking', path: `/${slug}/smart-parking`, icon: 'FiTruck' });
  if (hasService) systems.push({ id: 'service', name: 'Service Delivery', path: `/${slug}/service-delivery/dashboard`, icon: 'FiClipboard' });

  return systems.length > 0 ? systems : [{ id: 'dashboard', name: 'Dashboard', path: `/${slug}/dashboard`, icon: 'FiHome' }];
};

export const hasDedicatedDashboard = (user: any): boolean => {
  const department = getUserDepartment(user);
  return department.toLowerCase().includes('system admin');
};

// ==================== Legacy Support ====================

export const useUserNavigation = () => {
  return {
    getNavigation: (user: User | null) => getNavigationByPermissions(user),
    toSidebarLinks,
  };
};

export default {
  hasPermission,
  isAdminRole,
  getRoleSlug,
  formatRoleName,
  getNavigationByPermissions,
  toSidebarLinks,
  getCurrentSystemFromPath,
  getDashboardRoute,
  getUserDepartment,
  getUserSystems,
  hasDedicatedDashboard,
  useUserNavigation,
};
