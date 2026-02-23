const mongoose = require('mongoose');
const user_model = require('../../models/user.js');

module.exports = async function update_user(req, res, next) {
    try {
        const { id } = req.params;

        // Validate the MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid user ID format."
            });
        }

        // Extract allowed fields from request body
        const {
            full_name = null,
            telephone = null,
            identification = {},
            gender = null,
            title = null,
            email = null,
            department_name = "Not specified",
            department_id = "Not specified",
            access_control = null,
            roles = null
        } = req.body;

        //  Find the user first
        const user = await user_model.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "User not found to update."
            });
        }

        //  Uniqueness Check for Email and Telephone (if they are being changed)
        const conflict_checks = [];
        if (email && email !== user.email) {
            conflict_checks.push({ email: email });
        }
        if (telephone && telephone !== user.telephone) {
            conflict_checks.push({ telephone: telephone });
        }

        if (conflict_checks.length > 0) {
            const existing_user = await user_model.findOne({ $or: conflict_checks });
            if (existing_user) {
                const conflict_field = existing_user.email === email ? 'Email' : 'Telephone';
                return res.status(409).json({
                    success: false,
                    type: "warning",
                    message: `${conflict_field} is already in use by another account.`
                });
            }
        }

        //  Manually apply updates only to provided fields (Allow-listing)
        if (full_name !== undefined) user.full_name = full_name;
        if (telephone !== undefined) user.telephone = telephone;
        if (gender !== undefined) user.gender = gender;
        if (title !== undefined) user.title = title;
        if (email !== undefined) user.email = email;
        if (department_name !== undefined) user.department_name = department_name;
        if (department_id !== undefined) user.department_id = department_id;

        // Nested Objects require careful assignment
        if (identification) {
            if (identification.id_type !== undefined) user.identification.id_type = identification.id_type;
            if (identification.number !== undefined) user.identification.number = identification.number;
        }

        if (access_control) {
            if (access_control.is_locked !== undefined) user.access_control.is_locked = access_control.is_locked;
            if (access_control.reason !== undefined) user.access_control.reason = access_control.reason;
        }

        if (roles) {
            if (roles.role_name !== undefined) user.roles.role_name = roles.role_name;
            if (roles.permissions !== undefined) user.roles.permissions = roles.permissions;
        }

        //  Save the updated document
        const updated_user = await user.save();

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Employee data updated successfully",
        });

    } catch (error) {
        console.error("Error in update_user controller:", error);

        return res.status(500).json({
            success: false,
            type: "error",
            message: "Failed to update employee details",
            error: error.message
        });
    }
};