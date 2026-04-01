const xlsx = require('xlsx');
const mongoose = require('mongoose');
const crypto = require('crypto');
const user_model = require('../../models/user.js');
const allowed_resources = require('../../resources/resources.js');
const department_model = require('../../models/department.js');

/**
 * Bulk create employees from Excel/CSV file
 * Required columns: fullname, telephone, email, gender
 * Department details provided separately in request body
 */
module.exports = async function create_multiple_employees(req, res, next) {
    let session = null;
    
    try {
        // Get department details from request body
        const {
            department_id = null,
            department_unit = null,
            roles = {}
        } = req.body || {};

        // Check for upload errors from multer
        if (req.UploadError) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: req.UploadError.message
            });
        }

        // Handle file upload
        let uploadedFiles = [];
        
        if (req.files && req.files.length > 0) {
            uploadedFiles = req.files.filter(f => f.fieldname === 'file' || f.fieldname === 'files');
        } else if (req.file) {
            uploadedFiles = [req.file];
        }

        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: 'No file provided. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).'
            });
        }

        // Process the uploaded file
        let allEmployeesData = [];
        
        for (let file of uploadedFiles) {
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const fileData = xlsx.utils.sheet_to_json(sheet);
            allEmployeesData = allEmployeesData.concat(fileData);
        }

        if (allEmployeesData.length === 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: 'The uploaded file is empty.'
            });
        }

        // Validate department_id if provided
        let dpt = null;
        if (department_id && department_id !== 'Not specified') {
            if (!mongoose.Types.ObjectId.isValid(department_id)) {
                return res.status(400).json({
                    success: false,
                    type: "warning",
                    message: `Invalid department_id format: ${department_id}`
                });
            }
            
            dpt = await department_model.findById(department_id);
            if (!dpt) {
                return res.status(404).json({
                    success: false,
                    type: "warning",
                    message: `Department with ID ${department_id} not found. Please create it first or use another department.`
                });
            }
        }

        // Map and validate each row
        const mappedEmployees = [];
        const errors = [];
        
        for (let index = 0; index < allEmployeesData.length; index++) {
            const row = allEmployeesData[index];
            const rowNumber = index + 2; // +2 because Excel rows start at 1 and header is row 1
            
            // Extract fields with case-insensitive matching
            const fullname = row['fullname'] || row['fullName'] || row['FullName'] || row['Full Name'] || row['full name'] || null;
            const telephone = row['telephone'] || row['Telephone'] || row['phone'] || row['Phone'] || null;
            const email = row['email'] || row['Email'] || row['EMAIL'] || null;
            const gender = row['gender'] || row['Gender'] || row['GENDER'] || null;
            
            const rowErrors = [];
            
            // Validate required fields
            if (!fullname || fullname.toString().trim() === '') {
                rowErrors.push(`fullname is required and cannot be empty for record ${rowNumber}`);
            }
            
            if (!telephone || telephone.toString().trim() === '') {
                rowErrors.push(`telephone is required and cannot be empty for record ${rowNumber}`);
            }
            
            if (!email || email.toString().trim() === '') {
                rowErrors.push(`email is required and cannot be empty for record ${rowNumber}`);
            }
            
            if (!gender || gender.toString().trim() === '') {
                rowErrors.push(`gender is required and cannot be empty for record ${rowNumber}`);
            }
            
            // Validate gender value
            if (gender && !['Male', 'Female','male','female','other', 'Other', 'Not specified'].includes(gender.toString().trim())) {
                rowErrors.push(`gender must be one of: Male, Female, Other, Not specified for record ${rowNumber}`);
            }
            
            // Validate email format if provided
            if (email && email.toString().trim() !== '') {
                const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
                if (!emailRegex.test(email.toString().trim())) {
                    rowErrors.push(`invalid email format for record ${rowNumber}`);
                }
            }
            
            // Validate telephone format (basic validation - at least 10 digits)
            if (telephone && telephone.toString().trim() !== '') {
                const phoneStr = telephone.toString().trim();
                const phoneDigits = phoneStr.replace(/\D/g, '');
                if (phoneDigits.length < 10) {
                    rowErrors.push(`telephone should have at least 10 digits for record ${rowNumber}`);
                }
            }
            
            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNumber,
                    errors: rowErrors,
                    data: row
                });
                continue; // Skip this row, don't add to mappedEmployees
            }
            
            mappedEmployees.push({
                full_name: fullname.toString().trim(),
                telephone: telephone.toString().trim(),
                email: email.toString().trim().toLowerCase(),
                gender: gender.toString().trim(),
                row_number: rowNumber,
                original_data: row
            });
        }
        
        // If there are validation errors, return them without saving anything
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Validation failed for ${errors.length} row(s) and No employees were created fix and reupload again.`,
                errors: errors,
                guidance: {
                    required_columns: ['fullname', 'telephone', 'email', 'gender'],
                    gender_options: ['Male', 'Female', 'Other', 'Not specified'],
                    email_format: 'example@domain.com',
                    telephone_format: 'At least 10 digits'
                }
            });
        }
        
        // Check for duplicate emails and telephones within the file
        const emailMap = new Map();
        const telephoneMap = new Map();
        const duplicateErrors = [];
        
        for (const emp of mappedEmployees) {
            if (emailMap.has(emp.email)) {
                duplicateErrors.push({
                    row: emp.row_number,
                    field: 'email',
                    value: emp.email,
                    message: `Duplicate email found in file. First occurrence at row ${emailMap.get(emp.email)}`
                });
            } else {
                emailMap.set(emp.email, emp.row_number);
            }
            
            if (telephoneMap.has(emp.telephone)) {
                duplicateErrors.push({
                    row: emp.row_number,
                    field: 'telephone',
                    value: emp.telephone,
                    message: `Duplicate telephone found in file. First occurrence at row ${telephoneMap.get(emp.telephone)}`
                });
            } else {
                telephoneMap.set(emp.telephone, emp.row_number);
            }
        }
        
        if (duplicateErrors.length > 0) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: `Duplicate entries found in the file. No employees were created, fix and reupload`,
                errors: duplicateErrors
            });
        }
        
        // Check for existing users in database
        const emails = mappedEmployees.map(emp => emp.email);
        const telephones = mappedEmployees.map(emp => emp.telephone);
        
        const existingUsers = await user_model.find({
            $or: [
                { email: { $in: emails } },
                { telephone: { $in: telephones } }
            ]
        });
        
        const existingEmails = new Set(existingUsers.filter(u => u.email).map(u => u.email));
        const existingTelephones = new Set(existingUsers.filter(u => u.telephone).map(u => u.telephone));
        
        const existingErrors = [];
        
        for (const emp of mappedEmployees) {
            if (existingEmails.has(emp.email)) {
                existingErrors.push({
                    row: emp.row_number,
                    field: 'email',
                    message: `Email ${emp.email} already exists in the system`
                });
            }
            if (existingTelephones.has(emp.telephone)) {
                existingErrors.push({
                    row: emp.row_number,
                    field: 'telephone',
                    message: `Telephone ${emp.telephone} already exists in the system`
                });
            }
        }
        
        if (existingErrors.length > 0) {
            return res.status(409).json({
                success: false,
                type: "warning",
                message: `Some records already exist in the system. No employees were created, fix and reupload`,
                errors: existingErrors
            });
        }
        
        // Build permissions structure
        const allPermissions = [];
        const allResources = allowed_resources.map(r => r.resource_name);
        
        allResources.forEach(resourceName => {
            const resourceDef = allowed_resources.find(r => r.resource_name === resourceName);
            
            if (resourceDef) {
                resourceDef.actions.forEach(actionDef => {
                    allPermissions.push({
                        resource_name: resourceName,
                        actions: [{
                            action_type: actionDef.action_type,
                            description: actionDef.description,
                            is_enabled: "disabled"
                        }]
                    });
                });
            }
        });
        
        // Process incoming permissions if provided
        if (roles.permissions && Array.isArray(roles.permissions)) {
            for (const perm of roles.permissions) {
                const resourceName = perm.resource?.trim() || perm.resource_name?.trim();
                
                if (!resourceName) continue;
                
                const resourceDef = allowed_resources.find(
                    r => r.resource_name.toLowerCase() === resourceName.toLowerCase()
                );
                
                if (!resourceDef) {
                    return res.status(400).json({
                        success: false,
                        type: "warning",
                        message: `Invalid resource: ${resourceName}`
                    });
                }
                
                const incomingActions = perm.actions || [];
                
                incomingActions.forEach(action => {
                    const actionType = typeof action === 'string' ? action : action.action_type;
                    
                    const targetPermission = allPermissions.find(p => 
                        p.resource_name.toLowerCase() === resourceName.toLowerCase() &&
                        p.actions[0].action_type === actionType
                    );
                    
                    if (targetPermission) {
                        targetPermission.actions[0].is_enabled = "enabled";
                    }
                });
            }
        }
        
        // Group permissions by resource
        const groupedPermissions = [];
        const resourceMap = new Map();
        
        allPermissions.forEach(perm => {
            const resourceName = perm.resource_name;
            if (!resourceMap.has(resourceName)) {
                resourceMap.set(resourceName, {
                    resource_name: resourceName,
                    actions: []
                });
                groupedPermissions.push(resourceMap.get(resourceName));
            }
            resourceMap.get(resourceName).actions.push(perm.actions[0]);
        });
        
        // Start transaction
        session = await mongoose.startSession();
        session.startTransaction();
        
        const createdEmployees = [];
        
        try {
            // Create all employees
            for (const emp of mappedEmployees) {
                const generated_password = crypto.randomBytes(8).toString('hex');
                const default_picture = 'https://placehold.co/800?text=CoK&font=roboto';
                const registered_by = req.user ? req.user?.name || req.user?.email || 'System' : 'System';
                
                const new_user = new user_model({
                    full_name: emp.full_name,
                    telephone: emp.telephone,
                    identification: {
                        id_type: 'Not specified',
                        number: 'Not specified'
                    },
                    picture: default_picture,
                    gender: emp.gender,
                    title: 'Not specified',
                    email: emp.email,
                    department: dpt ? dpt._id : null,
                    department_unit: department_unit || null,
                    password: generated_password,
                    access_control: {
                        is_locked: false,
                        reason: null,
                        last_login_attempt: 0
                    },
                    auth: {
                        access_token: { token_type: null, token: null }
                    },
                    roles: {
                        role_name: roles.role_name || 'Not specified',
                        permissions: groupedPermissions
                    },
                    is_active: false,
                    is_account_activated: false,
                    registered_by
                });
                
                await new_user.save({ session });
                createdEmployees.push({
                    full_name: emp.full_name,
                    email: emp.email,
                    telephone: emp.telephone
                });
            }
            
            // Update department total_employees if department exists
            if (dpt && department_id && department_id !== 'Not specified') {
                dpt.total_employees = (dpt.total_employees || 0) + mappedEmployees.length;
                await dpt.save({ session });
            }
            
            // Commit transaction
            await session.commitTransaction();
            
            return res.status(201).json({
                success: true,
                type: "success",
                message: `${createdEmployees.length} employee(s) created successfully.`,
                total_created: createdEmployees.length,
                department_updated: dpt ? {
                    department_name: dpt.name,
                    new_total_employees: dpt.total_employees
                } : null,
                created_employees: createdEmployees,
                note: "Accounts require activation before employees can log in."
            });
            
        } catch (dbError) {
            // Rollback transaction on error
            if (session) {
                await session.abortTransaction();
            }
            throw dbError;
        }
        
    } catch (error) {
        console.error("Error in create_multiple_employees:", error);
        
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while creating employees",
            error: error.message
        });
    } finally {
        if (session) {
            session.endSession();
        }
    }
};