// Department Utilities
// Dynamic routing based on user role from login

// Map roles to dashboard routes
const ROLE_ROUTES: { [key: string]: string } = {
  'system': '/admin/dashboard',
  'admin': '/admin/dashboard',
  'administrator': '/admin/dashboard',
  'system admin': '/admin/dashboard',
  'it': '/smart_parking/dashboard',
  'finance': '/smart_parking/dashboard',
  'hr': '/service_delivery/dashboard',
  'human resources': '/service_delivery/dashboard',
  'legal': '/service_delivery/dashboard',
  'operations': '/smart_parking/dashboard',
};

// Get dashboard route based on user role
export const getDashboardRoute = async (role: string, departmentName?: string): Promise<string> => {
  console.log('[getDashboardRoute] Looking up route for role:', role, 'department:', departmentName);
  
  // Try role first
  if (role) {
    const normalizedRole = role.toLowerCase().trim();
    console.log('[getDashboardRoute] Normalized role:', normalizedRole);
    
    // Check for exact match
    if (ROLE_ROUTES[normalizedRole]) {
      console.log('[getDashboardRoute] Found role match:', ROLE_ROUTES[normalizedRole]);
      return ROLE_ROUTES[normalizedRole];
    }
    
    // Check for partial match
    for (const [key, route] of Object.entries(ROLE_ROUTES)) {
      if (normalizedRole.includes(key) || key.includes(normalizedRole)) {
        console.log('[getDashboardRoute] Found partial role match:', key, '->', route);
        return route;
      }
    }
  }
  
  // Try department name if role doesn't match
  if (departmentName) {
    const normalizedDept = departmentName.toLowerCase().trim();
    
    // Check for admin department
    if (normalizedDept.includes('admin') || normalizedDept.includes('system')) {
      console.log('[getDashboardRoute] Found admin department:', normalizedDept);
      return '/admin/dashboard';
    }
    
    // Check for HR/Legal
    if (normalizedDept.includes('hr') || normalizedDept.includes('human') || normalizedDept.includes('legal')) {
      console.log('[getDashboardRoute] Found service department:', normalizedDept);
      return '/service_delivery/dashboard';
    }
    
    // Check for IT/Finance/Operations
    if (normalizedDept.includes('it') || normalizedDept.includes('finance') || normalizedDept.includes('operations')) {
      console.log('[getDashboardRoute] Found parking department:', normalizedDept);
      return '/smart_parking/dashboard';
    }
  }
  
  // Default fallback - go to under-development page for unrecognized roles
  console.log('[getDashboardRoute] No match found, redirecting to Under Development');
  return '/under-development';
};

// Sync version for cases where we can't await
export const getDashboardRouteSync = (role: string, departmentName?: string): string => {
  if (!role && !departmentName) {
    return '/under-development';
  }
  
  const normalizedRole = (role || '').toLowerCase().trim();
  
  // Check role
  if (normalizedRole && ROLE_ROUTES[normalizedRole]) {
    return ROLE_ROUTES[normalizedRole];
  }
  
  // Check partial role match
  for (const [key, route] of Object.entries(ROLE_ROUTES)) {
    if (normalizedRole.includes(key) || key.includes(normalizedRole)) {
      return route;
    }
  }
  
  // Check department
  if (departmentName) {
    const normalizedDept = departmentName.toLowerCase().trim();
    if (normalizedDept.includes('admin') || normalizedDept.includes('system')) {
      return '/admin/dashboard';
    }
  }
  
  return '/under-development';
};

// Check if user has admin access
export const isAdminRole = (role: string): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized.includes('admin') || normalized.includes('system');
};

// Get role display name
export const getRoleDisplayName = (role: string): string => {
  if (!role) return 'User';
  
  const normalized = role.toLowerCase().trim();
  
  const displayNames: { [key: string]: string } = {
    'system': 'System Administrator',
    'admin': 'Administrator',
    'administrator': 'Administrator',
    'it': 'IT Staff',
    'finance': 'Finance Staff',
    'hr': 'HR Staff',
    'human resources': 'HR Staff',
    'legal': 'Legal Staff',
    'operations': 'Operations Staff',
  };
  
  return displayNames[normalized] || role;
};

// Get system name based on route
export const getSystemNameFromRoute = (route: string): string => {
  const routeMap: { [key: string]: string } = {
    '/admin/dashboard': 'Admin Portal',
    '/smart_parking/dashboard': 'Smart Parking',
    '/service_delivery/dashboard': 'Service Delivery',
  };
  
  return routeMap[route] || 'Dashboard';
};

export default {
  getDashboardRoute,
  getDashboardRouteSync,
  isAdminRole,
  getRoleDisplayName,
  getSystemNameFromRoute,
};
