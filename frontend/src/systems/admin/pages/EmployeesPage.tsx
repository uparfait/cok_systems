// EmployeesPage - Admin Employee Management
// Page for managing employees in the COK Systems
// Updated with inline form errors/success and no close button

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { employeeService, departmentService, permissionService, roleService } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
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
  department?: string | {
    _id?: string;
    department_id?: string;
    department_name?: string;
  };
  department_name?: string;
  department_id?: string;
  department_unit?: string;
  status?: string;
  roles?: {
    role_name: string;
    permissions: any[];
  };
  createdAt?: string;
}

// Interface for employee permissions from backend (with is_enabled)
type EmployeePermissionBackend = {
  resource_name: string;
  actions: Array<{
    action_type: string;
    description: string;
    is_enabled?: string;
  }>;
};

// Helper function to convert backend permission format to frontend format
// Backend: { resource_name: 'employees', actions: [{ action_type: 'read', is_enabled: 'enabled', ... }] }
// Frontend: { resource: 'employees', actions: ['read', 'create', ...] }
const convertBackendPermissionsToFrontend = (
  backendPermissions: EmployeePermissionBackend[]
): Array<{ resource: string; actions: string[] }> => {
  if (!backendPermissions || !Array.isArray(backendPermissions)) {
    return [];
  }

  return backendPermissions
    .filter((perm) => perm.actions && Array.isArray(perm.actions))
    .map((perm) => ({
      resource: perm.resource_name,
      actions: perm.actions
        .filter((action) => action.is_enabled === 'enabled')
        .map((action) => action.action_type),
    }))
    .filter((perm) => perm.actions.length > 0);
};

// Department interface for dropdown
interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string;
}

// Interface for system permissions from backend (with descriptions)
type SystemPermissionResource = {
  resource: string;
  actions: Array<{
    action_type: string;
    description: string;
  }>;
};

// Interface for role from backend
interface RoleFromBackend {
  _id?: string;
  role_name: string;
  permissions?: Array<{
    resource_name: string;
    actions: Array<{
      action: string;
      description?: string;
      is_enabled?: boolean;
    }>;
  }>;
}

const EmployeesPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<SystemPermissionResource[]>([]);
  const [roles, setRoles] = useState<RoleFromBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [departmentUnits, setDepartmentUnits] = useState<Department[]>([]);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  
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

  // Check if modal is opened and load permissions/roles if needed
  useEffect(() => {
    if (showModal) {
      setFormError('');
      setFormSuccess('');
      if (systemPermissions.length === 0) {
        loadSystemPermissions();
      }
      if (roles.length === 0) {
        loadRoles();
      }
    }
  }, [showModal, systemPermissions.length, roles.length]);

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
        // Keep the full action objects with descriptions
        setSystemPermissions(response.data);
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
        // Use backend message with priority
        setError(response.message || response.error || 'Failed to load employees');
      }
    } catch (err: any) {
      console.error('Error loading employees:', err);
      if (err?.status === false) {
        // Use backend message with priority
        setError(err.message || err.error || 'Failed to load employees. Please try again.');
      } else if (err?.message?.includes('Network')) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else if (err?.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'An error occurred while loading employees');
      }
    } finally {
      setLoading(false);
      setfirstLoad(false);
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

  // Load department units for selected department
  const loadDepartmentUnits = async (departmentId: string) => {
    if (!departmentId) {
      setDepartmentUnits([]);
      return;
    }

    try {
      const response = await departmentService.getAll();
      if (response.success) {
        const deptData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        
        // Filter sub-departments that belong to this department
        const units = deptData.filter((dept: any) => {
          return dept.sub_department_mng?.is_sub_department && 
                 dept.sub_department_mng?.parent_department_id === departmentId;
        });
        setDepartmentUnits(units);
      }
    } catch (err: any) {
      console.error('Failed to load department units:', err);
    }
  };

  // Load roles from backend
  const loadRoles = async () => {
    try {
      const response = await roleService.getAll();
      console.log('Roles Response:', response);
      
      if (response.success && response.data) {
        const rolesData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        setRoles(rolesData);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
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
      // Use backend message with priority
      setError(err.message || err.error || 'Search failed');
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
      department_unit: '',
      roles: {
        role_name: 'department_employee',
        permissions: []
      }
    });
    setDepartmentUnits([]);
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (employee: Employee) => {
    // Convert backend permissions format to frontend format
    const convertedPermissions = convertBackendPermissionsToFrontend(
      employee.roles?.permissions as unknown as EmployeePermissionBackend[] || []
    );
    
    // Handle department - can be string, object with department_name, or undefined
    const deptObj = employee.department as { _id?: string; department_id?: string; department_name?: string } | undefined;
    const deptName = typeof employee.department === 'object' 
      ? employee.department?.department_name 
      : employee.department_name || '';
    const deptId = typeof employee.department === 'object' 
      ? employee.department?._id 
      : employee.department_id || '';
    
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name || '',
      telephone: employee.telephone || '',
      email: employee.email || '',
      identification: employee.identification || { id_type: 'National ID', number: '' },
      gender: employee.gender || '',
      title: employee.title || '',
      department: deptName,
      department_name: deptName,
      department_id: deptId,
      department_unit: employee.department_unit || '',
      roles: {
        role_name: employee.roles?.role_name || 'department_employee',
        permissions: convertedPermissions
      }
    });
    // Load department units if department is selected
    if (deptId) {
      loadDepartmentUnits(deptId);
    }
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
          setFormSuccess(response.message || 'Employee updated successfully!');
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
          setFormSuccess(response.message || 'Employee created successfully!');
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

  // Handle delete - show confirmation modal
  const handleDeleteClick = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
    setShowDeleteConfirm(true);
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    
    try {
      setDeleting(true);
      await employeeService.delete(deletingId);
      setShowDeleteConfirm(false);
      loadEmployees();
    } catch (err: any) {
      // Use backend message with priority
      setError(err.message || err.error || 'Failed to delete employee');
    } finally {
      setDeleting(false);
      setDeletingId(null);
      setDeletingName('');
    }
  };

  // Cancel delete handler
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingId(null);
    setDeletingName('');
  };

  return (
    <MainLayout>
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
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
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
              {(loading && firstLoad) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
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
                      <span className="text-sm text-gray-900">
                        {/* Handle both direct department_name and populated department object */}
                        {employee.department_name || (typeof employee.department === 'object' && employee.department?.department_name) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                      {/* fetches the user role - format role_name nicely (replace underscores with spaces) */}
                        {employee.roles?.role_name ? employee.roles.role_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
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
                          onClick={() => handleDeleteClick(employee._id || employee.employee_id || '', employee.full_name || 'this employee')}
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
            className="bg-white rounded-2xl w-full max-w-lg sm:max-w-xl md:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl transform animate-scaleIn m-3 sm:m-6"
          >
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50 sticky top-0 flex items-center justify-between">
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
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Close"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
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
                <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Success!</p>
                    <p className="text-green-700">{formSuccess}</p>
                  </div>
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
                        // Load department units when department is selected
                        if (selectedDept?._id) {
                          loadDepartmentUnits(selectedDept._id);
                        } else {
                          setDepartmentUnits([]);
                        }
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
                      Department Unit (Optional)
                    </label>
                    <select
                      value={formData.department_unit || ''}
                      onChange={(e) => setFormData({ ...formData, department_unit: e.target.value })}
                      disabled={!formData.department_id || departmentUnits.length === 0}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Select department unit</option>
                      {departmentUnits.map((unit) => (
                        <option key={unit._id || unit.department_id} value={unit._id || unit.department_id}>
                          {unit.department_name}
                        </option>
                      ))}
                    </select>
                    {formData.department_id && departmentUnits.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">No department units available for this department</p>
                    )}
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
                      onChange={(e) => {
                        const selectedRole = roles.find(r => r.role_name === e.target.value);
                        let rolePermissions: Array<{ resource: string; actions: string[] }> = [];
                        
                        // If role has permissions, convert them to frontend format
                        if (selectedRole?.permissions) {
                          rolePermissions = selectedRole.permissions
                            .filter(p => p.actions && Array.isArray(p.actions))
                            .map(p => ({
                              resource: p.resource_name,
                              actions: p.actions
                                .filter(a => a.is_enabled)
                                .map(a => a.action)
                            }))
                            .filter(p => p.actions.length > 0);
                        }
                        
                        setFormData({ 
                          ...formData, 
                          roles: {
                            role_name: e.target.value,
                            permissions: rolePermissions
                          }
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {roles.length > 0 ? (
                        roles.map((role) => (
                          <option key={role._id || role.role_name} value={role.role_name}>
                            {role.role_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))
                      ) : (
                        <option value="">No roles available</option>
                      )}
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

                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {systemPermissions.length > 0 ? (
                    systemPermissions.map((resource) => {
                      const currentPerm = formData.roles?.permissions?.find(
                        p => p?.resource?.toLowerCase() === resource.resource?.toLowerCase()
                      );
                      const selectedActions = currentPerm?.actions || [];

                      return (
                        <div key={resource.resource} className="border border-gray-200 rounded-lg bg-white p-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-900 capitalize">
                              {resource.resource}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const allActionTypes = resource.actions.map(a => a.action_type);
                                const newActions = selectedActions.length === allActionTypes.length 
                                  ? [] 
                                  : allActionTypes;
                                
                                const newPermissions = (formData.roles?.permissions || []).filter(
                                  p => p?.resource?.toLowerCase() !== resource.resource?.toLowerCase()
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
                          <div className="space-y-2">
                            {resource.actions.map((action) => {
                              const isSelected = selectedActions.includes(action.action_type);
                              return (
                                <div key={action.action_type} className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600 flex-1">
                                    {action.description}
                                  </span>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newPermissions = (formData.roles?.permissions || []).filter(
                                          p => p?.resource?.toLowerCase() !== resource.resource?.toLowerCase()
                                        );
                                        
                                        if (e.target.checked) {
                                          newPermissions.push({
                                            resource: resource.resource,
                                            actions: [...selectedActions, action.action_type]
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
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                  </label>
                                </div>
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
                  disabled={submitting || !!formSuccess}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
                    formSuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${submitting ? 'opacity-50' : ''}`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : formSuccess ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiCheck className="w-4 h-4" />
                      Saved!
                    </span>
                  ) : editingEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Employee"
        message={`Are you sure you want to delete "${deletingName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        type="danger"
        isLoading={deleting}
      />
    </div>
    </MainLayout>
  );
};

export default EmployeesPage;

