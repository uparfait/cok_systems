

module.exports = [
    
    {
        resource_name: 'employees',
        actions: [
            { action_type: 'read:employees', description: 'Allow this user to  view a list of all employees' },
            { action_type: 'create:employees', description: 'Allow this user to  create an employee and provide permissions to this employee' },
            { action_type: 'update:employees', description: 'Allow this user to  update an existing employee data' },
            { action_type: 'delete:employees', description: 'Allow this user to  delete an employee' },
            { action_type: 'REALTIME:employees', description: 'Allow this user to  receive real-time updates on employee status changes' }
        ]
    },
    {
        resource_name: 'departments',
        actions: [
            { action_type: 'read:departments', description: 'Allow this user to view a list of all departments' },
            { action_type: 'create:departments', description: 'Allow this user to create a new department' },
            { action_type: 'update:departments', description: 'Allow this user to update an existing department' },
        
            { action_type: 'delete:departments', description: 'Allow this user to delete a department' },
            { action_type: 'REALTIME:departments', description: 'Allow this user to receive real-time updates on department changes' }
        ]
    },
    { resource_name: 'service delivery',
        actions: [
            { action_type: 'read:service delivery', description: 'Allow this user to view a list of all vistors' },
            { action_type: 'create:service delivery', description: 'Allow this user to create a new vistor record' },
            { action_type: 'update:service delivery', description: 'Allow this user to update an existing vistor record' },
            { action_type: 'delete:service delivery', description: 'Allow this user to delete a vistor record' },
            { action_type: 'REALTIME:service delivery', description: 'Allow this user to receive real-time updates on vistor status changes' }
        ]
    },

    {
        resource_name: 'smart parking',
        actions: [
            { action_type: 'read:smart parking', description: 'Allow this user to view smart parking data' },
            { action_type: 'create:smart parking', description: 'Allow this user to create new smart parking record' },
            { action_type: 'update:smart parking', description: 'Allow this user to update smart parking data' },
            { action_type: 'delete:smart parking', description: 'Allow this user to delete smart parking record' },
            { action_type: 'REALTIME:smart parking', description: 'Allow this user to receive real-time updates on smart parking status changes' }
        ]
    }
]