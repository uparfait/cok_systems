// THE ADDRESS THE SYSTEM SENDS FROM, however EMAIL_FROM is written.
//
// A From header may carry a display name ("IKAZE <a@b>") or not ("<a@b>",
// "a@b"). The deployment writes the bare address, so the system's own name
// is put in front of it here; an EMAIL_FROM that already carries a name is
// left exactly as it is. Without this the mail arrives showing nothing but
// an address.
// How the connection to the mail server starts. Port 465 answers with TLS
// from the first byte; 587 - the city's submission port - answers in the
// clear and STARTTLS upgrades it afterwards. EMAIL_SECURE settles it when
// the port is not a reliable guide, which on this network it has not been:
// the same address has wanted different answers from a workstation and
// from a container. A wrong answer here costs one extra attempt and not
// the mail, because utilities/mail_transport.js tries the other way by
// itself (and remembers which one the server accepted).
const mail_secure = (value, port) => {
  const held = String(value || "").trim().toLowerCase();
  if (held === "true" || held === "1" || held === "yes") return true;
  if (held === "false" || held === "0" || held === "no") return false;
  return Number(port) === 465;
};

const mail_from = (value) => {
  const held = String(value || "").trim();
  // Nothing, or something that is not an address at all: the system's own.
  // Without this last test a stray EMAIL_FROM of "IKAZE" would be turned
  // into "IKAZE <IKAZE>" and the mail server would refuse every message -
  // and refuse it on the FIRST send rather than at startup, which is the
  // hardest kind of fault to find.
  if (!held || held.indexOf("@") < 0) return "IKAZE <coksystems@kigalicity.gov.rw>";
  if (/^[^<]+</.test(held)) return held;
  return `IKAZE ${held.startsWith("<") ? held : `<${held}>`}`;
};
const DB_CONFIG = {
    // Email Configuration (from environment variables)
    // The City's outgoing mail server: 197.243.27.181 on port 587 with
    // STARTTLS and SMTP authentication. Port 587 is the submission port, so
    // the connection opens in the clear and is upgraded to TLS before the
    // credentials are sent (see utilities/email.js).
    email: {
        host: process.env.EMAIL_HOST || '197.243.27.181',
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: mail_secure(process.env.EMAIL_SECURE, parseInt(process.env.EMAIL_PORT, 10) || 587),
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: mail_from(process.env.EMAIL_FROM)
    },

    // Redis Configuration
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },

    // JWT Configuration
    jwtSecret: process.env.JWT_SECRET || 'cok-jwt-secret-2026',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'cok-jwt-refresh-secret-2026',

    // Database Names
    db_names: {
        system_user: "system_users",
        departments: "departments",
        staff_cars_reserved: "staff_reserved",
        emergency_reserved_cars: "vistors_reserved",
        daily_parking_records: "parking_slots",
        daily_parking_records_history: "parking_slots_history",
        service_delivery: "service_delivary",
        feedback: "feedback_db"
    },

    // Role Definitions
    user_roles: [
        "system_admin", 
        "receptionist", 
        "head_of_department", 
        "department_employee", 
        "vehicle_registrar",
        "entrance_officer",
       
    ],

    // Schemas
    schemas: {
        system_user_schema: {
            full_name: "Amos",
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

