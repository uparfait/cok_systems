// EmployeesPage - Admin Employee Management
// Page for managing employees in the COK Systems
// Updated with inline form errors/success and no close button

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { employeeService, departmentService, permissionService } from '../../../core/services/adminService';
import { USER_ROLES } from '../../../core/constants/roles';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiRefreshCw, FiUsers,
  FiMail, FiPhone, FiBriefcase, FiUser, FiShield, FiCheck, FiX, FiAlertCircle
} from 'react-icons/fi';

interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  telephone?: string;
  email: string;
  identification?: {
    id_type: string;
    number: string;
  };
  gender?: string;
  title?: string;
  department?: string;
  department_name?: string;
  department_id?: string;
  status?: string;
  roles?: {
    role_name: string;
    permissions: Array<{
      resource: string;
      actions: string[];
    }>;
  };
  createdAt?: string;
}

// Department interface for dropdown
interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string;
}

// Interface for system permissions from backend
type SystemPermissionResource = {
  resource: string;
  actions: string[];
};

const EmployeesPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<SystemPermissionResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form-level error and success states
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    full_name: '',
    telephone: '',
    email: '',
    identification: {
      id_type: 'National ID',
      number: ''
    },
    gender: '',
    title: '',
    department: '',
    department_name: '',
    department_id: '',
    roles: {
      role_name: 'department_employee',
      permissions: []
    }
  });

  // Clear messages when modal opens
  useEffect(() => {
    if (showModal) {
      setFormError('');
      setFormSuccess('');
    }
  }, [showModal]);

  // Check auth and load employees
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadEmployees();
      loadDepartments();
      loadSystemPermissions();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load system permissions from backend
  const loadSystemPermissions = async () => {
    try {
      const response = await permissionService.getSystemPermissions();
      console.log('System Permissions Response:', response);
      
      if (response.success && response.data) {
        // Transform backend data to simpler format
        const transformed = response.data.map((item: any) => ({
          resource: item.resource,
          actions: item.actions.map((a: any) => a.action_type)
        }));
        setSystemPermissions(transformed);
      }
    } catch (err) {
      console.error('Error loading system permissions:', err);
    }
  };

  // Load employees
  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await employeeService.getAll();
      
      console.log('Employees API Response:', response);
      
      if (response.success) {
        // Handle both array response and object with data property
        const empData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        setEmployees(empData);
      } else {
        setError(response.error || 'Failed to load employees');
      }
    } catch (err: any) {
      console.error('Error loading employees:', err);
      if (err?.status === false) {
        setError(err.error || 'Failed to load employees. Please try again.');
      } else if (err?.message?.includes('Network')) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else if (err?.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'An error occurred while loading employees');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load departments for dropdown
  const loadDepartments = async () => {
    try {
      console.log('Loading departments for dropdown...');
      const response = await departmentService.getAll();
      console.log('Department dropdown response:', response);
      
      // Backend returns 'success' not 'status'
      if (response.success) {
        const deptData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        console.log('Departments loaded for dropdown:', deptData);
        setDepartments(deptData);
      } else {
        console.error('Failed to load departments - response:', response);
      }
    } catch (err: any) {
      console.error('Failed to load departments:', err);
    }
  };

  // Search employees
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadEmployees();
      return;
    }

    try {
      setLoading(true);
      const response = await employeeService.search(searchQuery);
      
      if (response.success) {
        const empData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        setEmployees(empData);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Open modal for new employee
  const handleNewEmployee = () => {
    setEditingEmployee(null);
    setFormData({
      full_name: '',
      telephone: '',
      email: '',
      identification: {
        id_type: 'National ID',
        number: ''
      },
      gender: '',
      title: '',
      department: '',
      department_name: '',
      department_id: '',
      roles: {
        role_name: 'department_employee',
        permissions: []
      }
    });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name || '',
      telephone: employee.telephone || '',
      email: employee.email || '',
      identification: employee.identification || { id_type: 'National ID', number: '' },
      gender: employee.gender || '',
      title: employee.title || '',
      department: employee.department || '',
      department_name: employee.department_name || '',
      department_id: employee.department_id || '',
      roles: employee.roles || {
        role_name: 'department_employee',
        permissions: []
      }
    });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setFormError('');
    setFormSuccess('');
    
    // Validate form data
    if (!formData.full_name?.trim() || !formData.email?.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      console.log('Submitting employee data:', formData);

      if (editingEmployee?._id || editingEmployee?.employee_id) {
        const id = editingEmployee._id || editingEmployee.employee_id || '';
        const response = await employeeService.update(id, formData);
        console.log('Update response:', response);
        
        if (response.success) {
          setFormSuccess('Employee updated successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadEmployees();
          }, 1500);
        } else {
          setFormError(response.error || 'Failed to update employee');
        }
      } else {
        const response = await employeeService.create(formData);
        console.log('Create response:', response);
        
        if (response.success) {
          setFormSuccess('Employee created successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadEmployees();
          }, 1500);
        } else {
          setFormError(response.error || 'Failed to create employee');
        }
      }
    } catch (err: any) {
      console.error('Employee save error:', err);
      
      // Check if it's a network error
      if (err.message && (err.message.includes('Network') || err.message.includes('Failed to fetch'))) {
        setFormError('Cannot connect to server. Please check your internet connection and try again.');
      } else if (err.error) {
        setFormError(err.error);
      } else if (err.message) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save employee. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      setLoading(true);
      await employeeService.delete(id);
      loadEmployees();
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiUsers className="w-8 h-8 text-blue-600" />
            Employees
          </h1>
          <p className="text-gray-500 mt-1">Manage employees in the organization</p>
        </div>
        <button
          onClick={handleNewEmployee}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Search
          </button>
          <button
            onClick={loadEmployees}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee._id || employee.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {(employee.full_name || 'E').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {employee.full_name || '-'}
                          </p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {employee.telephone && (
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <FiPhone className="w-4 h-4" />
                            {employee.telephone}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <FiMail className="w-4 h-4" />
                          {employee.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{employee.department_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {employee.title || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee._id || employee.employee_id || '')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - No close button, clicking outside won't close */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl transform animate-scaleIn"
          >
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FiUser className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {editingEmployee ? 'Update employee details' : 'Create a new employee'}
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Inline Error Message */}
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Inline Success Message */}
              {formSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Personal Information Section */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <FiUser className="w-4 h-4" />
                  Personal Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telephone
                    </label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <select
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select title</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Type
                    </label>
                    <select
                      value={formData.identification?.id_type}
                      onChange={(e) => setFormData({ ...formData, identification: { ...formData.identification!, id_type: e.target.value } })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="National ID">National ID</option>
                      <option value="Passport">Passport</option>
                      <option value="Driver License">Driver License</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Number
                    </label>
                    <input
                      type="text"
                      value={formData.identification?.number}
                      onChange={(e) => setFormData({ ...formData, identification: { ...formData.identification!, number: e.target.value } })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      placeholder="Enter ID number"
                    />
                  </div>
                </div>
              </div>

              {/* Department & Role Section */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4" />
                  Department & Role
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <select
                      value={formData.department_name}
                      onChange={(e) => {
                        const selectedDept = departments.find(d => d.department_name === e.target.value);
                        setFormData({ 
                          ...formData, 
                          department_name: e.target.value,
                          department_id: selectedDept?._id || ''
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept._id || dept.department_id} value={dept.department_name}>
                          {dept.department_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department ID
                    </label>
                    <input
                      type="text"
                      value={formData.department_id}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                      placeholder="Auto-filled"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-2">
                        <FiShield className="w-4 h-4" />
                        User Role
                      </span>
                    </label>
                    <select
                      value={formData.roles?.role_name || 'department_employee'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        roles: {
                          role_name: e.target.value,
                          permissions: formData.roles?.permissions || []
                        }
                      })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="bg-purple-50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <FiShield className="w-4 h-4" />
                  Permissions
                </h3>
                
                <p className="text-xs text-gray-600">
                  Select the permissions this employee should have for each system resource.
                </p>

                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {systemPermissions.length > 0 ? (
                    systemPermissions.map((resource) => {
                      const currentPerm = formData.roles?.permissions?.find(
                        p => p.resource.toLowerCase() === resource.resource.toLowerCase()
                      );
                      const selectedActions = currentPerm?.actions || [];

                      return (
                        <div key={resource.resource} className="border border-gray-200 rounded-lg bg-white p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 capitalize">
                              {resource.resource}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const allActions = resource.actions;
                                const newActions = selectedActions.length === allActions.length 
                                  ? [] 
                                  : allActions;
                                
                                const newPermissions = (formData.roles?.permissions || []).filter(
                                  p => p.resource.toLowerCase() !== resource.resource.toLowerCase()
                                );
                                
                                if (newActions.length > 0) {
                                  newPermissions.push({
                                    resource: resource.resource,
                                    actions: newActions
                                  });
                                }
                                
                                setFormData({
                                  ...formData,
                                  roles: {
                                    role_name: formData.roles?.role_name || 'department_employee',
                                    permissions: newPermissions
                                  }
                                });
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {selectedActions.length === resource.actions.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {resource.actions.map((action) => {
                              const isSelected = selectedActions.includes(action);
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => {
                                    const newPermissions = (formData.roles?.permissions || []).filter(
                                      p => p.resource.toLowerCase() !== resource.resource.toLowerCase()
                                    );
                                    
                                    if (isSelected) {
                                      const remainingActions = selectedActions.filter(
                                        (a) => a !== action
                                      );
                                      if (remainingActions.length > 0) {
                                        newPermissions.push({
                                          resource: resource.resource,
                                          actions: remainingActions
                                        });
                                      }
                                    } else {
                                      newPermissions.push({
                                        resource: resource.resource,
                                        actions: [...selectedActions, action]
                                      });
                                    }
                                    
                                    setFormData({
                                      ...formData,
                                      roles: {
                                        role_name: formData.roles?.role_name || 'department_employee',
                                        permissions: newPermissions
                                      }
                                    });
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    isSelected 
                                      ? 'bg-purple-600 text-white' 
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {isSelected && <FiCheck className="w-3 h-3" />}
                                  {action}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Loading permissions...
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : editingEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;

