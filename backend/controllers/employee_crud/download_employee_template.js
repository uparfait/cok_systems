const ExcelJS = require('exceljs');
const department_model = require('../../models/department.js');
const role_model = require('../../models/default_roles.js');

// Function to get Excel column letter
function getColumnLetter(colIndex) {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
        letter = String.fromCharCode(65 + (temp % 26)) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

module.exports = async function download_employee_template(req, res, next) {
    try {
        // Fetch all departments and roles
        const [allDepartments, allRoles] = await Promise.all([
            department_model.find({}).sort({ department_name: 1 }),
            role_model.find({}).sort({ role_name: 1 })
        ]);


        // Separate main and sub departments
        const mainDepartments = allDepartments.filter(dept => !dept.sub_department_mng?.is_sub_department);
        const subDepartments = allDepartments.filter(dept => dept.sub_department_mng?.is_sub_department);
     
        // ---------------------------------------------------------
        // CREATE WORKBOOK
        // ---------------------------------------------------------
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'cok';
        workbook.created = new Date();

        // ---------------------------------------------------------
        // MAIN SHEET (UNCHANGED)
        // ---------------------------------------------------------
        const worksheet = workbook.addWorksheet('Employee Template', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        worksheet.columns = [
            { header: 'Firstname', key: 'firstname', width: 20 },
            { header: 'Lastname', key: 'lastname', width: 20 },
            { header: 'Telephone', key: 'telephone', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Department', key: 'department', width: 25 },
            { header: 'Department Unit', key: 'department_unit', width: 25 },
            { header: 'Role', key: 'role', width: 20 }
        ];

        worksheet.columns.forEach(column => {
            column.numFmt = '@';
            column.alignment = { horizontal: 'left', vertical: 'middle' };
        });

        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E40AF' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });

        for (let i = 2; i <= 6; i++) {
            const row = worksheet.getRow(i);
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'hair' },
                    left: { style: 'hair' },
                    bottom: { style: 'hair' },
                    right: { style: 'hair' }
                };
            });
        }

        // ---------------------------------------------------------
        // DROPDOWN DATA SHEET
        // ---------------------------------------------------------
        const dataSheet = workbook.addWorksheet('DropdownData', { state: 'hidden' });

        // Gender
        const genderOptions = ['Male', 'Female', 'Other'];
        genderOptions.forEach((option, index) => {
            dataSheet.getCell(`A${index + 2}`).value = option;
        });

        workbook.definedNames.add(`DropdownData!$A$2:$A$${genderOptions.length + 1}`, 'GenderList');

        
        // Departments
        mainDepartments.forEach((dept, index) => {
            dataSheet.getCell(`B${index + 2}`).value = dept.department_name;
            
        });

       

        if (mainDepartments.length > 0) {
            workbook.definedNames.add(
                `DropdownData!$B$2:$B$${mainDepartments.length + 1}`,
                'DepartmentList'
            );
        }

        // ---------------------------------------------------------
        // ALL UNITS LIST (NEW FIX)
        // ---------------------------------------------------------
        const unitColumn = 'C';

        subDepartments.forEach((sub, index) => {
            dataSheet.getCell(`${unitColumn}${index + 2}`).value = sub.department_name;
        });

        if (subDepartments.length > 0) {
            workbook.definedNames.add(
                `DropdownData!$${unitColumn}$2:$${unitColumn}$${subDepartments.length + 1}`,
                'AllUnitsList'
            );
        }

        // ---------------------------------------------------------
        // ROLES LIST
        // ---------------------------------------------------------
        const roleColumn = 'D';
        const roleNames = allRoles.map(role => role.role_name);

        dataSheet.getCell(`${roleColumn}1`).value = 'Role Options';
        roleNames.forEach((roleName, index) => {
            dataSheet.getCell(`${roleColumn}${index + 2}`).value = roleName;
        });

        

        if (roleNames.length > 0) {
            //console.log(roleNames);
            workbook.definedNames.add(
                `DropdownData!$${roleColumn}$2:$${roleColumn}$${roleNames.length + 1}`,
                'RoleList'
            );
        }



        // ---------------------------------------------------------
        // APPLY VALIDATION
        // ---------------------------------------------------------
        for (let row = 2; row <= 500; row++) {

            // Gender
            worksheet.getCell(`E${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['GenderList']
            };

            // Department
            worksheet.getCell(`F${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['DepartmentList']
            };

            // Units (NOW GLOBAL LIST)
            worksheet.getCell(`G${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['AllUnitsList']
            };

            // Role
            worksheet.getCell(`H${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['RoleList']
            };
        }

        // ---------------------------------------------------------
        // SEND FILE
        // ---------------------------------------------------------
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="employee_template.xlsx"');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating employee template:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Failed to generate employee template',
            error: error.message
        });
    }
}; 