const ExcelJS = require('exceljs');
const department_model = require('../../models/department.js');
const role_model = require('../../models/default_roles.js');

// A department is a unit in either the new (is_unit + parent_department) or
// legacy (sub_department_mng) format; the legacy flag is sometimes the string "true"
const isUnitDept = (d) => {
    if (d.is_unit === true) return true;
    const legacy = d.sub_department_mng?.is_sub_department;
    return legacy === true || legacy === 'true';
};
const unitParentId = (d) => {
    if (d.parent_department) return d.parent_department.toString();
    if (d.sub_department_mng?.parent_department_id) return d.sub_department_mng.parent_department_id.toString();
    return null;
};

module.exports = async function download_employee_template(req, res, next) {
    try {
        const [allDepartments, allRoles] = await Promise.all([
            department_model.find({}).sort({ department_name: 1 }).lean(),
            role_model.find({}).sort({ role_name: 1 }).lean()
        ]);

        const mainDepartments = allDepartments.filter(dept => !isUnitDept(dept));
        const subDepartments = allDepartments.filter(dept => isUnitDept(dept));

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'cok';
        workbook.created = new Date();

        // ---------------------------------------------------------
        // MAIN SHEET
        // ---------------------------------------------------------
        const worksheet = workbook.addWorksheet('Employee Template', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        worksheet.columns = [
            { header: 'Firstname', key: 'firstname', width: 20 },       // A
            { header: 'Lastname', key: 'lastname', width: 20 },         // B
            { header: 'Telephone', key: 'telephone', width: 20 },       // C
            { header: 'Email', key: 'email', width: 30 },               // D
            { header: 'Gender', key: 'gender', width: 14 },             // E
            { header: 'Title', key: 'title', width: 22 },               // F
            { header: 'ID Type', key: 'id_type', width: 18 },           // G
            { header: 'ID Number', key: 'id_number', width: 22 },       // H
            { header: 'Department', key: 'department', width: 28 },     // I
            { header: 'Department Unit', key: 'department_unit', width: 28 }, // J
            { header: 'Role', key: 'role', width: 24 }                  // K
        ];

        worksheet.columns.forEach(column => {
            column.numFmt = '@';
            column.alignment = { horizontal: 'left', vertical: 'middle' };
        });

        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF056DAA' } };
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

        // Column A: Gender
        const genderOptions = ['Male', 'Female'];
        genderOptions.forEach((option, index) => {
            dataSheet.getCell(`A${index + 2}`).value = option;
        });
        workbook.definedNames.add(`DropdownData!$A$2:$A$${genderOptions.length + 1}`, 'GenderList');

        // Column B: Departments
        mainDepartments.forEach((dept, index) => {
            dataSheet.getCell(`B${index + 2}`).value = dept.department_name;
        });
        if (mainDepartments.length > 0) {
            workbook.definedNames.add(`DropdownData!$B$2:$B$${mainDepartments.length + 1}`, 'DepartmentList');
        }

        // Column C: Roles
        const roleNames = allRoles.map(role => role.role_name);
        roleNames.forEach((roleName, index) => {
            dataSheet.getCell(`C${index + 2}`).value = roleName;
        });
        if (roleNames.length > 0) {
            workbook.definedNames.add(`DropdownData!$C$2:$C$${roleNames.length + 1}`, 'RoleList');
        }

        // Column D: ID Types
        const idTypeOptions = ['National ID', 'Passport', 'Driver License'];
        idTypeOptions.forEach((option, index) => {
            dataSheet.getCell(`D${index + 2}`).value = option;
        });
        workbook.definedNames.add(`DropdownData!$D$2:$D$${idTypeOptions.length + 1}`, 'IdTypeList');

        // ---------------------------------------------------------
        // UNITS: a plain global list works in every spreadsheet app
        // (dependent INDIRECT validation is refused by several of them).
        // The bulk upload validates that a unit belongs to the selected
        // department and reports a clear row error if not.
        // ---------------------------------------------------------
        subDepartments.forEach((unit, index) => {
            dataSheet.getCell(`E${index + 2}`).value = unit.department_name;
        });
        if (subDepartments.length > 0) {
            workbook.definedNames.add(`DropdownData!$E$2:$E$${subDepartments.length + 1}`, 'AllUnitsList');
        }

        // ---------------------------------------------------------
        // APPLY VALIDATION
        // ---------------------------------------------------------
        for (let row = 2; row <= 500; row++) {
            worksheet.getCell(`E${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['GenderList']
            };

            worksheet.getCell(`G${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['IdTypeList']
            };

            if (mainDepartments.length > 0) {
                worksheet.getCell(`I${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['DepartmentList']
                };

                if (subDepartments.length > 0) {
                    worksheet.getCell(`J${row}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: ['AllUnitsList']
                    };
                }
            }

            if (roleNames.length > 0) {
                worksheet.getCell(`K${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['RoleList']
                };
            }
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
