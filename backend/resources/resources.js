

module.exports = [
    {
        resource_name: 'employees',
        actions: [
            { action_type: 'GET', description: 'View a list of all employees' },
            { action_type: 'POST', description: 'Create a new employee record' },
            { action_type: 'PUT', description: 'Update an existing employee record' },
            { action_type: 'DELETE', description: 'Delete an employee record' },
            { action_type: 'REALTIME', description: 'Receive real-time updates on employee status changes' }
        ]
    },
    {
        resource_name: 'departments',
        actions: [
            { action_type: 'GET', description: 'View a list of all departments' },
            { action_type: 'POST', description: 'Create a new department' },
            { action_type: 'PUT', description: 'Update an existing department' },
            { action_type: 'DELETE', description: 'Delete a department' },
            { action_type: 'REALTIME', description: 'Receive real-time updates on department changes' }
        ]
    },
    { resource_name: 'service delivery',
        actions: [
            { action_type: 'GET', description: 'View a list of all service deliveries' },
            { action_type: 'POST', description: 'Create a new service delivery record' },
            { action_type: 'PUT', description: 'Update an existing service delivery record' },
            { action_type: 'DELETE', description: 'Delete a service delivery record' },
            { action_type: 'REALTIME', description: 'Receive real-time updates on service delivery status changes' }
        ]
    },

    {
        resource_name: 'smart parking',
        actions: [
            { action_type: 'GET', description: 'View smart parking data' },
            { action_type: 'POST', description: 'Create new smart parking configuration' },
            { action_type: 'PUT', description: 'Update smart parking configuration' },
            { action_type: 'DELETE', description: 'Delete smart parking configuration' },
            { action_type: 'REALTIME', description: 'Receive real-time updates on smart parking status changes' }
        ]
    }
]