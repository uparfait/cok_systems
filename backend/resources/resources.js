

module.exports = [
    
    {
        resource_name: 'employees',
        actions: [
            { action_type: 'read:employees', description: 'A user with this permission can view a list of all employees' },
            { action_type: 'create:employees', description: 'A user with this permission can create an employee and provide permissions to this employee' },
            { action_type: 'update:employees', description: 'A user with this permission can update an existing employee data' },
            { action_type: 'delete:employees', description: 'A user with this permission can delete an employee' },
            { action_type: 'REALTIME:employees', description: 'A user with this permission can receive real-time updates on employee status changes' }
        ]
    },
    {
        resource_name: 'departments',
        actions: [
            { action_type: 'read:departments', description: 'A user with this permission view a list of all departments' },
            { action_type: 'create:departments', description: 'A user with this permission create a new department' },
            { action_type: 'update:departments', description: 'A user with this permission update an existing department' },
        
            { action_type: 'delete:departments', description: 'A user with this permission delete a department' },
            { action_type: 'REALTIME:departments', description: 'A user with this permission receive real-time updates on department changes' }
        ]
    },
    { resource_name: 'service delivery',
        actions: [
            { action_type: 'read:service delivery', description: 'A user with this permission view a list of all vistors' },
            { action_type: 'create:service delivery', description: 'A user with this permission create a new vistor record' },
            { action_type: 'update:service delivery', description: 'A user with this permission update an existing vistor record' },
            { action_type: 'delete:service delivery', description: 'A user with this permission delete a vistor record' },
            { action_type: 'REALTIME:service delivery', description: 'A user with this permission receive real-time updates on vistor status changes' }
        ]
    },

    {
        resource_name: 'smart parking',
        actions: [
            { action_type: 'read:smart parking', description: 'A user with this permission view smart parking data' },
            { action_type: 'create:smart parking', description: 'A user with this permission create new smart parking record' },
            { action_type: 'update:smart parking', description: 'A user with this permission update smart parking data' },
            { action_type: 'delete:smart parking', description: 'A user with this permission delete smart parking record' },
            { action_type: 'REALTIME:smart parking', description: 'A user with this permission receive real-time updates on smart parking status changes' }
        ]
    }
]