const crypto = require('crypto');
const user_model = require('../../models/user.js');

module.exports = async function create_user(req, res, next) {
    try {
        
        let {
            full_name = null,
            telephone = null,
            identification = {},
            gender = null,
            title = null,
            email = null,
            department_name = 'Not specified',
            department_id = 'Not specified',
            roles = {}
        } = req.body || {};

        //  Validate essential required fields
        if (!full_name || !email || !telephone) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Full name, telephone and email are required fields."
            });
        }

        //  Uniqueness Check for Email and Telephone
        const query_conditions = [];
        if (email) query_conditions.push({ email: email });
        if (telephone) query_conditions.push({ telephone: telephone });

        if (query_conditions.length > 0) {
            const existing_user = await user_model.findOne({ $or: query_conditions });
            if (existing_user) {
                const conflict_field = existing_user.email === email ? 'Email' : 'Telephone';
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: `${conflict_field} already exists in the system.`
                });
            }
        }

        // Generate system-assigned values
        const generated_password = crypto.randomBytes(8).toString('hex'); // E.g., 'a1b2c3d4e5f67890'
        const default_picture = 'https://placehold.co/800?text=CoK&font=roboto';
        const registered_by = req.user ? req.user?.name : 'Not specified';

        // construct the new user object
        const new_user = new user_model({
            full_name: full_name,
            telephone: telephone,
            identification: {
                id_type: identification.id_type || 'Not specified',
                number: identification.number || 'Not specified'
            },
            picture: default_picture,
            gender: gender || 'Not specified',
            title: title || 'Not specified',
            email: email,
            department_name: department_name,
            department_id: department_id,
            password: generated_password,
            
            // Set access control securely to defaults
            access_control: {
                is_locked: false,
                reason: null,
                last_login_attempt: 0
            },
            
            // Ensure auth is completely empty initially
            auth: {
                access_token: {
                    token_type: null,
                    token: null
                }
            },
            
            // Assign roles
            roles: {
                role_name: roles.role_name || 'Not specified',
                permissions: roles.permissions || []
            },
            
            
            is_active: false,
            is_account_activated: false,
            registered_by: registered_by
        });

        //  Save to Database
        const saved_user = await new_user.save();


        return res.status(201).json({
            success: true,
            type: "success",
            message: "Employee account created successfully. Account activation is required.",
        });

    } catch (error) {
        console.error("Error in create_user controller:", error);

        // Pass to global error handler
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while creating the user",
            error: error.message
        });
    }
};