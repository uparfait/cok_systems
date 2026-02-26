

module.exports = [
    {
        resource_name: 'employees',
        actions: [
            { action_type: 'read:employees', description: 'View a list of all employees' },
            { action_type: 'create:employees', description: 'Create a new employee record' },
            { action_type: 'update:employees', description: 'Update an existing employee record' },
            { action_type: 'delete:employees', description: 'Delete an employee record' },
            { action_type: 'REALTIME:employees', description: 'Receive real-time updates on employee status changes' }
        ]
    },
    {
        resource_name: 'departments',
        actions: [
            { action_type: 'read:departments', description: 'View a list of all departments' },
            { action_type: 'create:departments', description: 'Create a new department' },
            { action_type: 'update:departments', description: 'Update an existing department' },
        
            { action_type: 'delete:departments', description: 'Delete a department' },
            { action_type: 'REALTIME:departments', description: 'Receive real-time updates on department changes' }
        ]
    },
    { resource_name: 'service delivery',
        actions: [
            { action_type: 'read:service delivery', description: 'View a list of all service deliveries' },
            { action_type: 'create:service delivery', description: 'Create a new service delivery record' },
            { action_type: 'update:service delivery', description: 'Update an existing service delivery record' },
            { action_type: 'delete:service delivery', description: 'Delete a service delivery record' },
            { action_type: 'REALTIME:service delivery', description: 'Receive real-time updates on service delivery status changes' }
        ]
    },

    {
        resource_name: 'smart parking',
        actions: [
            { action_type: 'read:smart parking', description: 'View smart parking data' },
            { action_type: 'create:smart parking', description: 'Create new smart parking configuration' },
            { action_type: 'update:smart parking', description: 'Update smart parking configuration' },
            { action_type: 'delete:smart parking', description: 'Delete smart parking configuration' },
            { action_type: 'REALTIME:smart parking', description: 'Receive real-time updates on smart parking status changes' }
        ]
    }
]