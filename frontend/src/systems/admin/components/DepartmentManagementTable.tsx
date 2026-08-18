import React, { useState, useMemo } from "react";
import { departmentService, type Department, type Employee, } from "../../../core/services/adminService";
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiPackage, FiRefreshCw, FiChevronLeft, FiChevronRight, FiSearch, } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { EmployeesModal, ServicesModal } from "../pages/sub/DepartmentServiceModal";
import { FiLoader } from 'react-icons/fi';

interface DepartmentTableProps {
  departments: Department[]; employees: Employee[]; loading: boolean;
  onEdit: (dept: Department) => void; onDelete: (id: string, name: string) => void;
  onAddUnit: (dept: Department) => void; onViewDetails: (dept: Department) => void; refreshDepartments: () => void;
}

const DepartmentManagementTable: React.FC<DepartmentTableProps> = ({ departments, employees, loading, onEdit, onDelete, onAddUnit, onViewDetails, refreshDepartments }) => {
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [employeesSearchQuery, setEmployeesSearchQuery] = useState("");
  const [servicesPage, setServicesPage] = useState(1);
  const [serviceError, setServiceError] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const itemsPerPage = 10;

  const flattenedDepartments = useMemo(() => {
    const flattened: (Department & { isSubDepartment?: boolean; parentId?: string; level?: number })[] = [];
    departments.forEach((dept) => {
      if (dept.sub_department_mng?.is_sub_department !== true) {
        flattened.push({ ...dept, isSubDepartment: false, level: 0 });
        if (dept.sub_departments && dept.sub_departments.length > 0) {
          dept.sub_departments.forEach((subDept) => { flattened.push({ ...subDept, isSubDepartment: true, parentId: dept._id, level: 1 }); });
        }
      }
    });
    return flattened;
  }, [departments]);

  const getDepartmentEmployees = (dept: Department) => {
    const deptName = dept.name;
    let filtered = employees.filter((emp: any) => emp.department === deptName || emp.department?.department_name === deptName || emp.department?._id === dept._id);
    if (employeesSearchQuery.trim()) { const q = employeesSearchQuery.toLowerCase(); filtered = filtered.filter((emp: any) => emp.full_name?.toLowerCase().includes(q) || emp.email?.toLowerCase().includes(q) || emp.telephone?.toLowerCase().includes(q)); }
    return filtered;
  };

  const getSubDepartmentCount = (dept: Department) => dept.sub_departments ? dept.sub_departments.length : 0;

  const handleShowEmployees = (dept: Department) => { setSelectedDepartment(dept); setEmployeesPage(1); setEmployeesSearchQuery(""); setShowEmployeesModal(true); };
  const handleShowServices = (dept: Department) => { setSelectedDepartment(dept); setServicesPage(1); setShowServicesModal(true); };

  const handleAddService = async (name: string, desc: string) => {
    if (!selectedDepartment || !name.trim()) { setServiceError("Service name is required"); return; }
    try { setServiceLoading(true); setServiceError("");
      const r = await departmentService.addService(selectedDepartment._id || selectedDepartment.department_id || "", { name: name.trim(), description: desc.trim() });
      if (r.success) { if (r.data?.services) setSelectedDepartment({ ...selectedDepartment, services: r.data.services }); refreshDepartments(); }
      else setServiceError(r.message || "Failed");
    } catch (err: any) { setServiceError(err.message || "Failed"); } finally { setServiceLoading(false); }
  };

  const handleEditService = async (id: string, name: string, desc: string) => {
    if (!selectedDepartment || !id || !name.trim()) { setServiceError("Service name is required"); return; }
    try { setServiceLoading(true); setServiceError("");
      const r = await departmentService.updateService(selectedDepartment._id || selectedDepartment.department_id || "", id, { name: name.trim(), description: desc.trim() });
      if (r.success) { if (r.data?.services) setSelectedDepartment({ ...selectedDepartment, services: r.data.services }); refreshDepartments(); }
      else setServiceError(r.message || "Failed");
    } catch (err: any) { setServiceError(err.message || "Failed"); } finally { setServiceLoading(false); }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedDepartment) return;
    try { setServiceLoading(true); setServiceError("");
      const r = await departmentService.deleteService(selectedDepartment._id || selectedDepartment.department_id || "", serviceId);
      if (r.success) { if (r.data?.services) setSelectedDepartment({ ...selectedDepartment, services: r.data.services }); refreshDepartments(); }
      else setServiceError(r.message || "Failed");
    } catch (err: any) { setServiceError(err.message || "Failed"); } finally { setServiceLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="cok-primary-bg border-b border-gray-200">
              {['Department Name', 'Department ID', 'Room Number', 'Department Leader', 'Employees', 'Services', 'Units', 'buttons'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h.toLocaleUpperCase()}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {loading ? <tr><td colSpan={9} className="px-4 py-6 text-center"><div className="flex justify-center items-center gap-2"><FiLoader className="w-6 h-6 animate-spin text-[#056daa]" /><span className="text-sm text-gray-500">Loading...</span></div></td></tr>
                : flattenedDepartments.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center"><HiOutlineOfficeBuilding className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">No departments found</p></td></tr>
                  : flattenedDepartments.map((dept) => {
                    const deptEmployees = getDepartmentEmployees(dept);
                    const deptServices = dept.services || [];
                    const subDeptCount = getSubDepartmentCount(dept);
                    const isSubDept = dept.isSubDepartment;
                    return (
                      <tr key={`${dept._id}-${isSubDept ? "sub" : "parent"}`} className={`hover:bg-[#F7F9FB] transition-colors ${isSubDept ? "bg-[rgba(41,128,185,0.08)]" : ""}`}>
                        <td className="px-4 py-3"><div className={`flex items-center gap-2 ${isSubDept ? "ml-6" : ""}`}>
                          <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isSubDept ? "bg-[rgba(41,128,185,0.08)]" : "bg-[rgba(5,109,170,0.1)]"}`}><HiOutlineOfficeBuilding className={`w-4 h-4 ${isSubDept ? "text-[#2980B9]" : "text-[#056daa]"}`} /></div>
                          <div className="min-w-0"><p className={`text-sm font-normal truncate max-w-48 ${isSubDept ? "text-[#2980B9]" : "text-gray-900"}`} title={dept.name}>{dept.name}</p>{dept.description && <p className="text-xs text-gray-500 truncate max-w-48">{dept.description}</p>}</div></div></td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 font-medium ${isSubDept ? "bg-[rgba(41,128,185,0.08)] text-[#2980B9]" : "bg-gray-100 text-gray-700"}`}>{dept.department_id}</span></td>
                        <td className="px-4 py-3">{dept.room_number ? <span className="text-xs px-2 py-0.5 bg-[rgba(243,156,18,0.12)] text-[#F39C12]">🚪 {dept.room_number}</span> : <span className="text-gray-400 text-sm">—</span>}</td>
                        <td className="px-4 py-3"><p className="text-sm">{typeof dept.department_leader === "object" && dept.department_leader ? dept.department_leader.full_name || dept.department_leader.email || "Not assigned" : typeof dept.department_leader === "string" ? dept.department_leader : "Not assigned"}</p></td>
                        <td className="px-4 py-3 text-center"><button onClick={() => handleShowEmployees(dept)} className="inline-flex items-center gap-1 px-2.5 py-1.5 cok-btn-primary text-sm font-semibold"><FiUsers className="w-3.5 h-3.5" />{deptEmployees.length}</button></td>
                        <td className="px-4 py-3 text-center"><button onClick={() => handleShowServices(dept)} className="inline-flex items-center gap-1 px-2.5 py-1.5 cok-btn-primary text-sm font-semibold"><FiPackage className="w-3.5 h-3.5" />{deptServices.length}</button></td>
                        <td className="px-4 py-3 text-center">{!isSubDept ? <span className={`text-xs px-2 py-0.5 font-semibold ${subDeptCount > 0 ? "bg-[rgba(5,109,170,0.1)] text-[#056daa]" : "bg-gray-100 text-gray-600"}`}>{subDeptCount}</span> : <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3"><div className="flex items-center gap-1">{!isSubDept && <button onClick={() => onAddUnit(dept)} className="p-1.5 text-white cursor-pointer cok-primary-bg " title="Add Unit"><FiPlus className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => onEdit(dept)} className="p-1.5 cok-primary-color cursor-pointer hover:bg-[#F7F9FB]" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(dept._id || dept.department_id || "", dept.name || "this department")} className="p-1.5 text-[#E74C3C] hover:bg-[rgba(231,76,60,0.08)]" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button></div></td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeesModal show={showEmployeesModal} department={selectedDepartment} employees={employees} loading={false} page={employeesPage} searchQuery={employeesSearchQuery} onClose={() => setShowEmployeesModal(false)} onSearchChange={setEmployeesSearchQuery} onPageChange={setEmployeesPage} itemsPerPage={itemsPerPage} getEmployees={getDepartmentEmployees} />
      <ServicesModal show={showServicesModal} department={selectedDepartment} loading={serviceLoading} page={servicesPage} onClose={() => { setShowServicesModal(false); setServiceError(""); }} onPageChange={setServicesPage} itemsPerPage={itemsPerPage} services={selectedDepartment?.services || []} onAdd={handleAddService} onEdit={handleEditService} onDelete={handleDeleteService} error={serviceError} actionLoading={serviceLoading} />
    </div>
  );
};

export default DepartmentManagementTable;