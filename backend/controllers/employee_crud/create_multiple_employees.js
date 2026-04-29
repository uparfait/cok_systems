const xlsx = require('xlsx');
const mongoose = require('mongoose');
const crypto = require('crypto');
const user_model = require('../../models/user.js');
const allowed_resources = require('../../resources/resources.js');
const department_model = require('../../models/department.js');
const role_model = require('../../models/default_roles.js');

/**
 * Bulk create employees from Excel/CSV file
 * Required columns: fullname, telephone, email, gender
 * Department details provided separately in request body
 */
module.exports = async function create_multiple_employees(req, res, next) {
    let session = null;

    try {
        // Fetch all roles and departments for validation
        const [allRoles, allDepartments] = await Promise.all([
            role_model.find({}).sort({ role_name: 1 }),
            department_model.find({}).sort({ department_name: 1 })
        ]);

        const validRoleNames = allRoles.map(role => role.role_name);
        const validDepartmentNames = allDepartments.map(dept => dept.department_name);

        // Separate main departments and sub-departments
        const mainDepartments = allDepartments.filter(dept => !dept.sub_department_mng?.is_sub_department);
        const subDepartments = allDepartments.filter(dept => dept.sub_department_mng?.is_sub_department);

        // Group sub-departments by parent ID for validation
        const subDeptByParent = {};
        subDepartments.forEach(sub => {
            const parentId = sub.sub_department_mng.parent_department_id.toString();
            if (!subDeptByParent[parentId]) {
                subDeptByParent[parentId] = [];
            }
            subDeptByParent[parentId].push(sub);
        });


        

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




        // Map and validate each row
        const mappedEmployees = [];
        const errors = [];
        
        for (let index = 0; index < allEmployeesData.length; index++) {
            const row = allEmployeesData[index];
            const rowNumber = index + 2; // +2 because Excel rows start at 1 and header is row 1
            
            // Extract fields with case-insensitive matching
            const firstname = row['firstname'] || row['firstName'] || row['Firstname'] || row['First Name'] || row['first name'] || null;
            const lastname = row['lastname'] || row['lastName'] || row['Lastname'] || row['Last Name'] || row['last name'] || null;
            const fullname = row['fullname'] || row['fullName'] || row['FullName'] || row['Full Name'] || row['full name'] || null;
            const telephone = row['telephone'] || row['Telephone'] || row['phone'] || row['Phone'] || null;
            const email = row['email'] || row['Email'] || row['EMAIL'] || null;
            const gender = row['gender'] || row['Gender'] || row['GENDER'] || null;
            const department = row['department'] || row['Department'] || row['DEPARTMENT'] || null;
            const department_unit = row['department unit'] || row['department_unit'] || row['Department Unit'] || row['Department_Unit'] || row['DEPARTMENT UNIT'] || null;
            const role = row['role'] || row['Role'] || row['ROLE'] || null;
            
            const rowErrors = [];
            
            // Validate required fields
            let finalFullName = '';
            if (fullname && fullname.toString().trim() !== '') {
                finalFullName = fullname.toString().trim();
            } else if (firstname && lastname && firstname.toString().trim() !== '' && lastname.toString().trim() !== '') {
                finalFullName = `${firstname.toString().trim()} ${lastname.toString().trim()}`;
            } else {
                rowErrors.push(`Either fullname or both firstname and lastname are required for record ${rowNumber}`);
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

            // Validate department value if provided
            let selectedDepartment = null;
            let selectedDepartmentUnit = null;

            if (department && department.toString().trim() !== '') {
                const deptName = department.toString().trim();
                selectedDepartment = allDepartments.find(d => d.department_name === deptName);

                if (!selectedDepartment) {
                    rowErrors.push(`department "${deptName}" does not exist. Available departments: ${validDepartmentNames.join(', ')} for record ${rowNumber}`);
                } else if (selectedDepartment.sub_department_mng?.is_sub_department) {
                    rowErrors.push(`department "${deptName}" is a sub-department, not a main department. Please select a main department for record ${rowNumber}`);
                }
            }

            // Validate department unit value if provided
            if (department_unit && department_unit.toString().trim() !== '' && department_unit.toString().trim() !== 'Select') {
                const unitName = department_unit.toString().trim();
                selectedDepartmentUnit = allDepartments.find(d => d.department_name === unitName);

                if (!selectedDepartmentUnit) {
                    rowErrors.push(`department unit "${unitName}" does not exist for record ${rowNumber}`);
                } else if (!selectedDepartmentUnit.sub_department_mng?.is_sub_department) {
                    rowErrors.push(`"${unitName}" is a main department, not a sub-department. Department units must be sub-departments for record ${rowNumber}`);
                } else if (selectedDepartment) {
                    // Check if the unit belongs to the selected department
                    const parentId = selectedDepartmentUnit.sub_department_mng.parent_department_id.toString();
                    if (parentId !== selectedDepartment._id.toString()) {
                        const parentDept = allDepartments.find(d => d._id.toString() === parentId);
                        rowErrors.push(`department unit "${unitName}" does not belong to department "${selectedDepartment.department_name}". It belongs to "${parentDept ? parentDept.department_name : 'unknown department'}" for record ${rowNumber}`);
                    }
                }
            }

            // Validate role value if provided
            if (role && role.toString().trim() !== '') {
                const roleName = role.toString().trim();
                if (!validRoleNames.includes(roleName)) {
                    rowErrors.push(`role "${roleName}" does not exist. Available roles: ${validRoleNames.join(', ')} for record ${rowNumber}`);
                }
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
                full_name: finalFullName,
                telephone: telephone.toString().trim(),
                email: email.toString().trim().toLowerCase(),
                gender: gender.toString().trim(),
                department: selectedDepartment ? selectedDepartment._id : null,
                department_unit: selectedDepartmentUnit ? selectedDepartmentUnit._id : null,
                role: role && role.toString().trim() !== '' ? role.toString().trim() : (validRoleNames.includes('Basic') ? 'Basic' : validRoleNames[0]),
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
                    name_options: ['Use "fullname" column OR both "firstname" and "lastname" columns'],
                    required_columns: ['telephone', 'email', 'gender'],
                    optional_columns: ['firstname', 'lastname', 'fullname', 'department', 'department_unit', 'role'],
                    gender_options: ['Male', 'Female', 'Other', 'Not specified'],
                    department_options: validDepartmentNames,
                    department_unit_options: subDepartments.map(sub => sub.department_name),
                    role_options: validRoleNames,
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
        
        // Function to get permissions based on role from database
        const getPermissionsByRole = (roleName) => {
            const role = allRoles.find(r => r.role_name.toLowerCase() === roleName.toLowerCase());
            if (role) {
                // Return permissions from the database role
                return role.permissions.map(perm => ({
                    resource_name: perm.resource_name,
                    actions: perm.actions.map(action => ({
                        action_type: action.action,
                        description: action.description,
                        is_enabled: action.is_enabled ? "enabled" : "disabled"
                    }))
                }));
            }

            // Fallback: if role not found, return basic permissions (read-only)
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

            // Enable only read permissions as fallback
            allPermissions.forEach(perm => {
                perm.actions.forEach(action => {
                    if (action.action_type.includes('read')) {
                        action.is_enabled = "enabled";
                    }
                });
            });

            return allPermissions;
        };


        
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

                // Get permissions based on employee role
                const employeePermissions = getPermissionsByRole(emp.role);

                // Group permissions by resource for this employee
                const groupedEmployeePermissions = [];
                const resourceMap = new Map();

                employeePermissions.forEach(perm => {
                    const resourceName = perm.resource_name;
                    if (!resourceMap.has(resourceName)) {
                        resourceMap.set(resourceName, {
                            resource_name: resourceName,
                            actions: []
                        });
                        groupedEmployeePermissions.push(resourceMap.get(resourceName));
                    }
                    resourceMap.get(resourceName).actions.push(perm.actions[0]);
                });

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
                    department: emp.department,
                    department_unit: emp.department_unit,
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
                        role_name: emp.role,
                        permissions: groupedEmployeePermissions
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
            
            // Update department total_employees for each department used
            const departmentUpdateMap = new Map();

            for (const emp of mappedEmployees) {
                if (emp.department) {
                    const deptId = emp.department.toString();
                    if (!departmentUpdateMap.has(deptId)) {
                        departmentUpdateMap.set(deptId, {
                            department: await department_model.findById(deptId).session(session),
                            count: 0
                        });
                    }
                    departmentUpdateMap.get(deptId).count++;
                }

                if (emp.department_unit) {
                    const unitId = emp.department_unit.toString();
                    if (!departmentUpdateMap.has(unitId)) {
                        departmentUpdateMap.set(unitId, {
                            department: await department_model.findById(unitId).session(session),
                            count: 0
                        });
                    }
                    departmentUpdateMap.get(unitId).count++;
                }
            }

            // Update all department counts
            for (const [deptId, updateInfo] of departmentUpdateMap) {
                if (updateInfo.department) {
                    updateInfo.department.total_employees = (updateInfo.department.total_employees || 0) + updateInfo.count;
                    await updateInfo.department.save({ session });
                }
            }
            
            // Commit transaction
            await session.commitTransaction();
            
            // Prepare department update summary
            const departmentUpdates = [];
            for (const [deptId, updateInfo] of departmentUpdateMap) {
                if (updateInfo.department) {
                    departmentUpdates.push({
                        department_name: updateInfo.department.department_name,
                        new_total_employees: updateInfo.department.total_employees
                    });
                }
            }

            return res.status(201).json({
                success: true,
                type: "success",
                message: `${createdEmployees.length} employee(s) created successfully.`,
                total_created: createdEmployees.length,
                departments_updated: departmentUpdates.length > 0 ? departmentUpdates : null,
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