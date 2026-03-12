// Employee Management Tab Component

import { useState, useEffect } from "react";
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiEye, FiArrowRight, FiPhone, FiMail, FiUser } from "react-icons/fi";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "../EmployeeModals";
import { getAllEmployees, createEmployee, updateEmployee, deleteEmployee } from "../../../../../core/services/api";

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'available' | 'busy' | 'off';
  email: string;
  phone: string;
  avatar?: string;
  initials?: string;
}

interface EmployeeManagementTabProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

const EmployeeManagementTab: React.FC<EmployeeManagementTabProps> = ({ employees, setEmployees }) => {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("all");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch employees from API only if no employees are provided
  useEffect(() => {
    const fetchEmployees = async () => {
      // Only fetch if employees array is empty
      if (employees.length > 0) return;
      
      setIsLoading(true);
      try {
        const response = await getAllEmployees();
        if (response.data && Array.isArray(response.data)) {
          const formattedEmployees = response.data.map((emp: any) => ({
            id: emp._id || emp.id,
            name: emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.name || emp.email,
            email: emp.email,
            phone: emp.phone_number || emp.phone || emp.telephone || '',
            role: emp.title || emp.role || 'Employee',
            department: emp.department?.name || emp.department || 'General',
            status: emp.status === 'active' ? 'available' : emp.status === 'busy' ? 'busy' : 'off',
            initials: emp.first_name && emp.last_name 
              ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase()
              : emp.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'EM'
          }));
          setEmployees(formattedEmployees);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        // Keep using mock data if API fails
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployees();
  }, [setEmployees, employees.length]);

  // Handle add employee button click - just open modal
  const handleAddEmployeeClick = () => {
    setSelectedEmployee(null);
    setShowAddModal(true);
  };

  // Handle delete with API
  const handleDeleteEmployee = async () => {
    if (selectedEmployee) {
      try {
        await deleteEmployee(selectedEmployee.id);
        setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
      } catch (error) {
        console.error('Error deleting employee:', error);
        // Fallback to local delete
        setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
      }
      setShowDeleteModal(false);
    }
  };

  // Handle edit with API
  const handleEditEmployee = async (updatedData: Partial<Employee>) => {
    if (selectedEmployee) {
      try {
        await updateEmployee(selectedEmployee.id, updatedData);
        setEmployees(prev => prev.map(e => 
          e.id === selectedEmployee.id ? { ...e, ...updatedData } : e
        ));
      } catch (error) {
        console.error('Error updating employee:', error);
        // Fallback to local update
        setEmployees(prev => prev.map(e => 
          e.id === selectedEmployee.id ? { ...e, ...updatedData } : e
        ));
      }
      setShowEditModal(false);
    }
  };

  // Generate color from name
  const getColorFromName = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get initials
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !employeeSearch ? true : 
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.phone.includes(employeeSearch);
    const matchesRole = employeeRoleFilter === 'all' ? true : emp.role.toLowerCase() === employeeRoleFilter.toLowerCase();
    const matchesStatus = employeeStatusFilter === 'all' ? true : emp.status.toLowerCase() === employeeStatusFilter.toLowerCase();
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (employeeCurrentPage - 1) * itemsPerPage,
    employeeCurrentPage * itemsPerPage
  );

  // Stats
  const totalEmployees = employees.length;
  const availableEmployees = employees.filter(e => e.status === 'available').length;
  const busyEmployees = employees.filter(e => e.status === 'busy').length;
  const offEmployees = employees.filter(e => e.status === 'off').length;

  // Handlers
  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>
          <p className="text-sm text-gray-500 mt-1">manage your department employees and their availability status.</p>
        </div>
        <button 
          onClick={handleAddEmployeeClick}
          className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white rounded-lg hover:bg-[#0369A1] transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-5">
        {/* Total Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{totalEmployees}</p>
              <p className="text-sm text-gray-500 mt-1">Total employees</p>
            </div>
            <div className="w-12 h-12 bg-[#E0F2FE] rounded-lg flex items-center justify-center">
              <FiUser className="w-6 h-6 text-[#0284C7]" />
            </div>
          </div>
        </div>

        {/* Available Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{availableEmployees}</p>
              <p className="text-sm text-green-600 mt-1">Available now</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Busy Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{busyEmployees}</p>
              <p className="text-sm text-gray-500 mt-1">Currently busy</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Off Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{offEmployees}</p>
              <p className="text-sm text-gray-500 mt-1">On leave/off</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-gray-400 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={employeeRoleFilter}
            onChange={(e) => setEmployeeRoleFilter(e.target.value)}
            className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            <option value="all">All Roles</option>
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
            <option value="Assistant">Assistant</option>
          </select>

          {/* Status Filter */}
          <select
            value={employeeStatusFilter}
            onChange={(e) => setEmployeeStatusFilter(e.target.value)}
            className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="off">Off</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F1F5F9]">
              <tr>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">EMPLOYEE</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ROLE</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">DEPARTMENT</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">STATUS</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">CONTACT</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {paginatedEmployees.map((employee) => (
                <tr key={employee.id} className="h-16 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[13px] mr-3 ${getColorFromName(employee.name)}`}>
                        {getInitials(employee.name)}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#1E293B]">{employee.name}</p>
                        <p className="text-[12px] text-[#64748B]">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{employee.role}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{employee.department}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
                      employee.status === 'available' ? 'bg-green-100 text-green-700' :
                      employee.status === 'busy' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {employee.status === 'available' ? '● Available' :
                       employee.status === 'busy' ? '● Busy' : '● Off'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{employee.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleView(employee)}
                        className="p-2 text-[#475569] hover:bg-gray-100 rounded-lg transition-colors"
                        title="View"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(employee)}
                        className="p-2 text-[#0284C7] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(employee)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[13px] text-[#64748B]">
            Showing {Math.min((employeeCurrentPage - 1) * itemsPerPage + 1, filteredEmployees.length)} to {Math.min(employeeCurrentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setEmployeeCurrentPage(Math.max(1, employeeCurrentPage - 1))}
              disabled={employeeCurrentPage === 1}
              className="w-7 h-7 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiArrowRight className="w-4 h-4 text-[#475569] rotate-180" />
            </button>
            {Array.from({ length: Math.min(4, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setEmployeeCurrentPage(page)}
                  className={`w-7 h-7 flex items-center justify-center text-[13px] font-medium rounded-[8px] transition-colors ${
                    employeeCurrentPage === page 
                      ? 'bg-[#0284C7] text-white' 
                      : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button 
              onClick={() => setEmployeeCurrentPage(Math.min(totalPages, employeeCurrentPage + 1))}
              disabled={employeeCurrentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiArrowRight className="w-4 h-4 text-[#475569]" />
            </button>
          </div>
        </div>
      </div>

      {/* Employee Modals */}
      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={selectedEmployee ? {
          id: selectedEmployee.id,
          empId: selectedEmployee.id,
          name: selectedEmployee.name,
          email: selectedEmployee.email,
          title: selectedEmployee.role,
          status: selectedEmployee.status === 'available' ? 'Active' : 'Away',
          initials: selectedEmployee.initials || selectedEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        } : null}
      />
      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        employee={selectedEmployee ? {
          id: selectedEmployee.id,
          empId: selectedEmployee.id,
          name: selectedEmployee.name,
          email: selectedEmployee.email,
          title: selectedEmployee.role,
          status: selectedEmployee.status === 'available' ? 'Active' : 'Away',
          initials: selectedEmployee.initials || selectedEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        } : null}
        onSave={async (updatedEmployee) => {
          try {
            await updateEmployee(selectedEmployee?.id, {
              first_name: updatedEmployee.name.split(' ')[0],
              last_name: updatedEmployee.name.split(' ').slice(1).join(' ') || '',
              email: updatedEmployee.email,
              title: updatedEmployee.title,
              status: updatedEmployee.status === 'Active' ? 'active' : 'away'
            });
            setEmployees(prev => prev.map(emp => 
              emp.id === selectedEmployee?.id ? { ...emp, name: updatedEmployee.name, role: updatedEmployee.title, email: updatedEmployee.email } : emp
            ));
          } catch (error) {
            console.error('Error updating employee:', error);
            // Fallback to local update
            setEmployees(prev => prev.map(emp => 
              emp.id === selectedEmployee?.id ? { ...emp, name: updatedEmployee.name, role: updatedEmployee.title, email: updatedEmployee.email } : emp
            ));
          }
        }}
      />
      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        employee={selectedEmployee ? {
          id: selectedEmployee.id,
          empId: selectedEmployee.id,
          name: selectedEmployee.name,
          email: selectedEmployee.email,
          title: selectedEmployee.role,
          status: selectedEmployee.status === 'available' ? 'Active' : 'Away',
          initials: selectedEmployee.initials || selectedEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        } : null}
        onDelete={async () => {
          try {
            await deleteEmployee(selectedEmployee?.id);
            setEmployees(prev => prev.filter(emp => emp.id !== selectedEmployee?.id));
          } catch (error) {
            console.error('Error deleting employee:', error);
            // Fallback to local delete
            setEmployees(prev => prev.filter(emp => emp.id !== selectedEmployee?.id));
          }
        }}
      />
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={async (newEmployee) => {
          try {
            const nameParts = newEmployee.name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';
            
            const response = await createEmployee({
              first_name: firstName,
              last_name: lastName,
              email: newEmployee.email,
              phone_number: newEmployee.phone,
              title: newEmployee.title,
              gender: newEmployee.gender,
              department_id: newEmployee.department
            });
            
            const initials = nameParts.map(n => n[0]).join('').toUpperCase();
            const newEmp: Employee = {
              id: response.data?._id || response.data?.id || Date.now().toString(),
              name: newEmployee.name,
              email: newEmployee.email,
              phone: newEmployee.phone,
              role: newEmployee.title,
              department: newEmployee.department,
              status: 'available',
              initials
            };
            setEmployees(prev => [...prev, newEmp]);
          } catch (error) {
            console.error('Error creating employee:', error);
            // Fallback to local add
            const initials = newEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase();
            const newEmp: Employee = {
              id: Date.now().toString(),
              name: newEmployee.name,
              email: newEmployee.email,
              phone: newEmployee.phone,
              role: newEmployee.title,
              department: newEmployee.department,
              status: 'available',
              initials
            };
            setEmployees(prev => [...prev, newEmp]);
          }
        }}
      />
    </div>
  );
};

export default EmployeeManagementTab;
