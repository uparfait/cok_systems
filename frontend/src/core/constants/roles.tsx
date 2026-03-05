// User Roles - matching backend config
export const USER_ROLES = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'head_of_department', label: 'Head of Department' },
  { value: 'department_employee', label: 'Department Employee' },
  { value: 'vehicle_registrar', label: 'Vehicle Registrar' },
  { value: 'entrance_officer', label: 'Entrance Officer' },
];

// System Resources and Permissions - matching backend resources.js
export const SYSTEM_RESOURCES = [
  {
    resource_name: 'employees',
    actions: [
      { action_type: 'read:employees', description: 'View employees' },
      { action_type: 'create:employees', description: 'Create employees' },
      { action_type: 'update:employees', description: 'Update employees' },
      { action_type: 'delete:employees', description: 'Delete employees' },
    ]
  },
  {
    resource_name: 'departments',
    actions: [
      { action_type: 'read:departments', description: 'View departments' },
      { action_type: 'create:departments', description: 'Create departments' },
      { action_type: 'update:departments', description: 'Update departments' },
      { action_type: 'delete:departments', description: 'Delete departments' },
    ]
  },
  {
    resource_name: 'service delivery',
    actions: [
      { action_type: 'read:service delivery', description: 'View service deliveries' },
      { action_type: 'create:service delivery', description: 'Create service deliveries' },
      { action_type: 'update:service delivery', description: 'Update service deliveries' },
      { action_type: 'delete:service delivery', description: 'Delete service deliveries' },
    ]
  },
  {
    resource_name: 'smart parking',
    actions: [
      { action_type: 'read:smart parking', description: 'View smart parking' },
      { action_type: 'create:smart parking', description: 'Create smart parking records' },
      { action_type: 'update:smart parking', description: 'Update smart parking' },
      { action_type: 'delete:smart parking', description: 'Delete smart parking records' },
    ]
  },
];

// Get all available actions for a resource
export const getResourceActions = (resourceName: string) => {
  const resource = SYSTEM_RESOURCES.find(
    r => r.resource_name.toLowerCase() === resourceName.toLowerCase()
  );
  return resource?.actions || [];
};

// Get all available resources
export const getResourceNames = () => {
  return SYSTEM_RESOURCES.map(r => r.resource_name);
};
