import { useState, useEffect } from "react";
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiEye, FiArrowRight, FiPhone, FiMail, FiUser } from "react-icons/fi";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "../EmployeeModals";
import { getAllEmployees, createEmployee, updateEmployee, deleteEmployee } from "../../../../../core/services/api";

// City of Kigali institutional design constants
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface Employee { id: string; name: string; role: string; department: string; status: 'available' | 'busy' | 'off'; email: string; phone: string; avatar?: string; initials?: string; }
interface EmployeeManagementTabProps { employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>; }

const EmployeeManagementTab: React.FC<EmployeeManagementTabProps> = ({ employees, setEmployees }) => {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("all");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (employees.length > 0) return;
      setIsLoading(true);
      try {
        const r = await getAllEmployees();
        if (r.data && Array.isArray(r.data)) {
          setEmployees(r.data.map((emp: any) => ({
            id: emp._id || emp.id,
            name: emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.name || emp.email,
            email: emp.email, phone: emp.phone_number || emp.phone || emp.telephone || '',
            role: emp.title || emp.role || 'Employee',
            department: emp.department?.name || emp.department || 'General',
            status: emp.status === 'active' ? 'available' : emp.status === 'busy' ? 'busy' : 'off',
            initials: emp.first_name && emp.last_name ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase() : emp.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'EM'
          })));
        }
      } catch (error) { } finally { setIsLoading(false); }
    }; fetchEmployees();
  }, [setEmployees, employees.length]);

  const filteredEmployees = employees.filter(emp => {
    const ms = !employeeSearch || emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) || emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) || emp.phone.includes(employeeSearch);
    const mr = employeeRoleFilter === 'all' || emp.role.toLowerCase() === employeeRoleFilter.toLowerCase();
    const ms2 = employeeStatusFilter === 'all' || emp.status.toLowerCase() === employeeStatusFilter.toLowerCase();
    return ms && mr && ms2;
  });
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginated = filteredEmployees.slice((employeeCurrentPage - 1) * itemsPerPage, employeeCurrentPage * itemsPerPage);
  const getColor = (name: string) => ['bg-[#E74C3C]','bg-[#056daa]','bg-[#4CAF50]','bg-[#F39C12]','bg-[#2980B9]','bg-[#CDB896]','bg-[#045d94]','bg-[#388E3C]'][name.charCodeAt(0) % 8];
  const getInits = (name: string) => name.split(' ').length >= 2 ? (name.split(' ')[0][0] + name.split(' ').slice(-1)[0][0]).toUpperCase() : name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div><h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Employee Management</h1><p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>Manage employees and availability.</p></div>
        <button onClick={() => { setSelectedEmployee(null); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#056daa] text-white text-[13px] font-semibold uppercase tracking-[1px] transition-colors hover:bg-[#045d94]" style={{ fontFamily: fontHeading, borderRadius: 0 }}><FiPlus className="w-3.5 h-3.5" />Add</button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ label: 'Total employees', value: employees.length, icon: FiUser, bg: 'bg-[rgba(5,109,170,0.1)]', color: 'text-[#056daa]' },{ label: 'Available now', value: employees.filter(e => e.status === 'available').length, icon: null, bg: 'bg-[rgba(76,175,80,0.12)]', color: 'text-[#4CAF50]' },{ label: 'Currently busy', value: employees.filter(e => e.status === 'busy').length, icon: null, bg: 'bg-[rgba(231,76,60,0.1)]', color: 'text-[#E74C3C]' },{ label: 'On leave/off', value: employees.filter(e => e.status === 'off').length, icon: null, bg: 'bg-[rgba(158,158,158,0.15)]', color: 'text-[#9E9E9E]' }].map((s, i) => (
          <div key={i} className="bg-white p-3" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div><p className={`text-lg font-bold ${s.color}`} style={{ fontFamily: fontHeading }}>{s.value}</p><p className={`text-xs mt-0.5 ${s.color}`} style={{ fontFamily: fontHeading }}>{s.label}</p></div>
              {s.icon && <div className={`w-8 h-8 ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>}
              {!s.icon && <div className={`w-8 h-8 ${s.bg} flex items-center justify-center`}><div className={`w-2.5 h-2.5 ${s.color.replace('text-', 'bg-').replace('-600','-500').replace('-700','-500')}`}></div></div>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-3" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input type="text" placeholder="Search..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-[#056daa] focus:shadow-[0px_4px_8px_rgba(5,109,170,0.25)] bg-[#F7F9FB] border border-transparent shadow-[0px_2px_4px_rgba(0,0,0,0.1)]" style={{ fontFamily: fontHeading, fontSize: '14px', borderRadius: 0 }} /></div>
          <select value={employeeRoleFilter} onChange={e => setEmployeeRoleFilter(e.target.value)} className="px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#056daa] bg-[#F7F9FB] border border-transparent shadow-[0px_2px_4px_rgba(0,0,0,0.1)]" style={{ fontFamily: fontHeading, fontSize: '14px', borderRadius: 0 }}><option value="all">All Roles</option><option value="Manager">Manager</option><option value="Staff">Staff</option></select>
          <select value={employeeStatusFilter} onChange={e => setEmployeeStatusFilter(e.target.value)} className="px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#056daa] bg-[#F7F9FB] border border-transparent shadow-[0px_2px_4px_rgba(0,0,0,0.1)]" style={{ fontFamily: fontHeading, fontSize: '14px', borderRadius: 0 }}><option value="all">All</option><option value="available">Available</option><option value="busy">Busy</option><option value="off">Off</option></select>
        </div>
      </div>

      <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB]"><tr>{['Employee','Role','Department','Status','Contact','Actions'].map(h => <th key={h} className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-4 py-2.5" style={{ fontFamily: fontHeading, color: TERTIARY }}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E0E0E0]">{paginated.map(emp => (
              <tr key={emp.id} className="h-14 hover:bg-gray-50">
                <td className="px-4 py-3"><div className="flex items-center"><div className={`w-8 h-8 flex items-center justify-center text-white text-xs font-bold mr-2 ${getColor(emp.name)}`}>{getInits(emp.name)}</div><div><p className="text-sm font-medium text-[#333333]">{emp.name}</p><p className="text-xs text-[#9E9E9E]">{emp.email}</p></div></div></td>
                <td className="px-4 py-3 text-xs text-[#555555]">{emp.role}</td>
                <td className="px-4 py-3 text-xs text-[#555555]">{emp.department}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 font-semibold ${emp.status === 'available' ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]' : emp.status === 'busy' ? 'bg-[rgba(231,76,60,0.1)] text-[#E74C3C]' : 'bg-[rgba(158,158,158,0.15)] text-[#9E9E9E]'}`}>{emp.status === 'available' ? '● Available' : emp.status === 'busy' ? '● Busy' : '● Off'}</span></td>
                <td className="px-4 py-3 text-xs text-[#555555]">{emp.phone}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => { setSelectedEmployee(emp); setShowViewModal(true); }} className="p-1.5 text-[#555555] hover:bg-gray-100"><FiEye className="w-3.5 h-3.5" /></button><button onClick={() => { setSelectedEmployee(emp); setShowEditModal(true); }} className="p-1.5 text-[#056daa] hover:bg-[rgba(5,109,170,0.08)]"><FiEdit2 className="w-3.5 h-3.5" /></button><button onClick={() => { setSelectedEmployee(emp); setShowDeleteModal(true); }} className="p-1.5 text-[#E74C3C] hover:bg-[rgba(231,76,60,0.08)]"><FiTrash2 className="w-3.5 h-3.5" /></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#E0E0E0] flex items-center justify-between"><p className="text-xs text-[#9E9E9E]">Showing {Math.min((employeeCurrentPage-1)*itemsPerPage+1, filteredEmployees.length)} to {Math.min(employeeCurrentPage*itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}</p><div className="flex items-center gap-1"><button onClick={() => setEmployeeCurrentPage(Math.max(1, employeeCurrentPage-1))} disabled={employeeCurrentPage===1} className="w-6 h-6 flex items-center justify-center border border-[#E0E0E0] hover:bg-gray-50 disabled:opacity-50"><FiArrowRight className="w-3 h-3 rotate-180" /></button>{Array.from({ length: Math.min(4, totalPages) }, (_, i) => i+1).map(p => <button key={p} onClick={() => setEmployeeCurrentPage(p)} className={`w-6 h-6 text-xs font-medium ${employeeCurrentPage === p ? 'bg-[#056daa] text-white' : 'border border-[#E0E0E0] text-[#555555] hover:bg-gray-50'}`}>{p}</button>)}<button onClick={() => setEmployeeCurrentPage(Math.min(totalPages, employeeCurrentPage+1))} disabled={employeeCurrentPage===totalPages} className="w-6 h-6 flex items-center justify-center border border-[#E0E0E0] hover:bg-gray-50 disabled:opacity-50"><FiArrowRight className="w-3 h-3" /></button></div></div>
      </div>

      <ViewEmployeeModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} employee={selectedEmployee ? { id: selectedEmployee.id, empId: selectedEmployee.id, name: selectedEmployee.name, email: selectedEmployee.email, title: selectedEmployee.role, status: selectedEmployee.status === 'available' ? 'Active' : 'Away', initials: selectedEmployee.initials || getInits(selectedEmployee.name) } : null} />
      <EditEmployeeModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} employee={selectedEmployee ? { id: selectedEmployee.id, empId: selectedEmployee.id, name: selectedEmployee.name, email: selectedEmployee.email, title: selectedEmployee.role, status: selectedEmployee.status === 'available' ? 'Active' : 'Away', initials: selectedEmployee.initials || getInits(selectedEmployee.name) } : null} onSave={async (u) => { try { await updateEmployee(selectedEmployee?.id, { first_name: u.name.split(' ')[0], last_name: u.name.split(' ').slice(1).join(' ') || '', email: u.email, title: u.title }); setEmployees(prev => prev.map(e => e.id === selectedEmployee?.id ? { ...e, name: u.name, role: u.title, email: u.email } : e)); } catch (error) { setEmployees(prev => prev.map(e => e.id === selectedEmployee?.id ? { ...e, name: u.name, role: u.title, email: u.email } : e)); } }} />
      <DeleteEmployeeModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} employee={selectedEmployee ? { id: selectedEmployee.id, empId: selectedEmployee.id, name: selectedEmployee.name, email: selectedEmployee.email, title: selectedEmployee.role, status: selectedEmployee.status === 'available' ? 'Active' : 'Away', initials: selectedEmployee.initials || getInits(selectedEmployee.name) } : null} onDelete={async () => { try { await deleteEmployee(selectedEmployee?.id); setEmployees(prev => prev.filter(e => e.id !== selectedEmployee?.id)); } catch (error) { setEmployees(prev => prev.filter(e => e.id !== selectedEmployee?.id)); } }} />
      <AddEmployeeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={async (newEmp) => { try { const r = await createEmployee({ first_name: newEmp.name.split(' ')[0], last_name: newEmp.name.split(' ').slice(1).join(' ') || '', email: newEmp.email, phone_number: newEmp.phone, title: newEmp.title, gender: newEmp.gender, department_id: newEmp.department }); const emp: Employee = { id: r.data?._id || Date.now().toString(), name: newEmp.name, email: newEmp.email, phone: newEmp.phone, role: newEmp.title, department: newEmp.department, status: 'available', initials: newEmp.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() }; setEmployees(prev => [...prev, emp]); } catch (error) { const emp: Employee = { id: Date.now().toString(), name: newEmp.name, email: newEmp.email, phone: newEmp.phone, role: newEmp.title, department: newEmp.department, status: 'available', initials: newEmp.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() }; setEmployees(prev => [...prev, emp]); } }} />
    </div>
  );
};

export default EmployeeManagementTab;