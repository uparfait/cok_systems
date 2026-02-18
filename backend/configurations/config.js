const DB_CONFIG = {
    // Database Names
    db_names: {
        system_user: "system_users",
        departments: "departments",
        staff_cars_reserved: "staff_reserved",
        emergency_reserved_cars: "vistors_reserved",
        daily_parking_records: "parking_slots",
        daily_parking_records_history: "parking_slots_history",
        service_delivery: "service_delivary"
    },

    // Role Definitions
    user_roles: [
        "system_admin", 
        "receptionist", 
        "head_of_department", 
        "department_employee", 
        "vehicle_registra"
    ],

    // Schemas
    schemas: {
        system_user_schema: {
            full_name: "",
            telephone: "",
            identification: { type: "", number: "" },
            picture: "",
            gender: "",
            title: "",
            email: "",
            department_name: "",
            department_id: "",
            password: "", 
            access_control: {
                is_locked: false,
                reason: "",
                last_login_attempt: 0
            },
            auth: { access_token: "" },
            roles: {
                role_name: "",
                permissions: []
            },
            is_active: true,
            created_date: new Date().toISOString(),
            registered_by: ""
        },

        departments_db_schema: {
            department_name: "",
            department_id: "",
            created_date: "",
            department_leader: "",
            total_employees: 0,
            registered_by: ""
        },

        staffcars_reserved_db_schema: {
            plate_number: "",
            identification: "",
            owner_name: "",
            department_name: "",
            is_active: true,
            registered_by: "",
            is_flagged: false
        },

        emergency_reserved_cars_db_schema: {
            total_reserved_space: 0,
            visitor_info: [{
                plate_number: "",
                driver_name: "",
                driver_identification: { type: "", number: "" },
                telephone_number: "",
                is_flagged: false
            }],
            validity: {
                from: null,
                to: null
            },
            registered_by: ""
        },

        daily_parking_records_schema: {
            plate_number: "",
            driver_identification: { type: "", number: "" },
            driver_name: "",
            driver_telephone: "",
            status: "active", // options: ["active", "completed"]
            driver_type: "regular", // options: ["staff", "visitor", "regular"]
            slot_number: "",
            check_in: null,
            check_out: null,
            duration: "",
            is_flagged: false,
            checked_in_by: ""
        },

        service_delivery_db_schema: {
            identification: { type: "", number: "" },
            full_name: "",
            telephone: "",
            email: "",
            department_name: "",
            department_id: "",
            date: "",
            gender: "",
            durations: {
                service_duration: "",
                entry_duration: "",
                emergency_duration: ""
            },
            items: "",
            status:  ['pending', 'inprogress', 'transfered', 'completed'],
            notes: [],
            registered_by: ""
        },

        audit_db_schema: {
            action: "",
            time: "",
            description: "",
            user_id: ""
        }
    }
};

module.exports = DB_CONFIG;