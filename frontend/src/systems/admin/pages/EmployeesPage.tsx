// EmployeesPage - Admin Employee Management
// Page for managing employees in the COK Systems
// Updated with inline form errors/success and no close button

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { employeeService, departmentService, roleService } from '../../../core/services/adminService';
import { dispatchToast } from '../../../core/services/apiClient';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import ErrorModal from '../../../core/components/Modals/ErrorModal';
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
    department_unit?: string;
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



// Department interface for dropdown
interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string;
  sub_department_mng?: {
    is_sub_department: boolean | string;
    parent_department_id: string;
  };
}

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
  const [allDepartments, setAllDepartments] = useState<Department[]>([]); // Full list to map unit IDs to names
  const [roles, setRoles] = useState<RoleFromBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [departmentUnits, setDepartmentUnits] = useState<Department[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  
  // Form-level error and success states
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Multiple employee upload state
  const [showMultipleUploadModal, setShowMultipleUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadErrors, setUploadErrors] = useState<any[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [errorModalErrors, setErrorModalErrors] = useState<any[]>([]);

  // Debounce timer for dynamic search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    department_unit: '',
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
      if (roles.length === 0) {
        loadRoles();
      }
    }
  }, [showModal, roles.length]);

  // Check auth and load employees
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadEmployees(1, pageLimit);
      loadDepartments();
      loadRoles();
    }
  }, [isAuthenticated, authLoading, navigate, pageLimit]);



  // Load employees with pagination
  const loadEmployees = async (page: number = 1, limit: number = pageLimit) => {
    try {
      setLoading(true);
      setfirstLoad(true);
      setError('');
      const response = await employeeService.getAll(page, limit);

      if (response.success) {
        const empData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setEmployees(empData);
        setTotalEmployees(response.total || empData.length);
        setTotalPages(Math.ceil((response.total || empData.length) / limit));
        setCurrentPage(page);
      } else {
        setError(response.message || response.error || 'Failed to load employees');
      }
    } catch (err: any) {
      if (err?.status === false) {
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
      const response = await departmentService.getAll();
      
      if (response.success) {
        const deptData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        
        // Store ALL departments (including units) for cross-referencing IDs to Names in the table
        setAllDepartments(deptData);

        // Filter out sub-departments for the main dropdown
        const mainDepartments = deptData.filter((d: any) => 
          !d.sub_department_mng?.is_sub_department && 
          d.sub_department_mng?.is_sub_department !== 'true'
        );
        setDepartments(mainDepartments);
      }
    } catch (err: any) {
      console.error('Failed to load departments:', err);
    }
  };

  // Load department units for selected department
  const loadDepartmentUnits = async (departmentId: string) => {
    if (!departmentId) {
      setDepartmentUnits([]);
      setLoadingUnits(false);
      return;
    }

    try {
      setLoadingUnits(true);
      const response = await departmentService.getAll();
      if (response.success) {
        const deptData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        
        // Filter sub-departments that belong to this department
        const units = deptData.filter((dept: any) => {
          return (dept.sub_department_mng?.is_sub_department === true || dept.sub_department_mng?.is_sub_department === 'true') && 
                 String(dept.sub_department_mng?.parent_department_id) === String(departmentId);
        });
        setDepartmentUnits(units);
      }
    } catch (err: any) {
      console.error('Failed to load department units:', err);
    } finally {
      setLoadingUnits(false);
    }
  };

  // Load roles from backend
  const loadRoles = async () => {
    try {
      const response = await roleService.getAll();
      if (response.success && response.data) {
        const rolesData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setRoles(rolesData);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  // Dynamic search employees (search doesn't support pagination in current API)
  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      loadEmployees(1, pageLimit);
      return;
    }

    try {
      setLoading(true);
      const response = await employeeService.search(query);

      if (response.success) {
        const empData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setEmployees(empData);
        // Reset pagination state for search results
        setTotalEmployees(empData.length);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (err: any) {
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
    // Safely extract department details (ensuring employee.department is not null)
    const hasDeptObj = employee.department && typeof employee.department === 'object';
    const deptName = hasDeptObj ? (employee.department as any)?.department_name : employee.department_name || '';
    const deptId = hasDeptObj ? (employee.department as any)?._id : employee.department_id || '';

    // Safely extract unit details
    const unitVal = employee.department_unit || (hasDeptObj && (employee.department as any).department_unit) || '';

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
      department_unit: unitVal,
      roles: {
        role_name: employee.roles?.role_name || 'department_employee',
        permissions: [] // Permissions will be managed automatically by backend
      }
    });
    
    if (deptId) {
      setLoadingUnits(true);
      loadDepartmentUnits(deptId);
    }
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormError('');
    setFormSuccess('');
    
    if (!formData.full_name?.trim() || !formData.email?.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      if (editingEmployee?._id || editingEmployee?.employee_id) {
        const id = editingEmployee._id || editingEmployee.employee_id || '';
        const response = await employeeService.update(id, formData);
        
        if (response.success) {
          setFormSuccess(response.message || 'Employee updated successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadEmployees(currentPage, pageLimit);
          }, 1500);
        } else {
          setFormError(response.error || 'Failed to update employee');
        }
      } else {
        const response = await employeeService.create(formData);
        
        if (response.success) {
          setFormSuccess(response.message || 'Employee created successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadEmployees(currentPage, pageLimit);
          }, 1500);
        } else {
          setFormError(response.error || 'Failed to create employee');
        }
      }
    } catch (err: any) {
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

  const handleDeleteClick = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    
    try {
      setDeleting(true);
      await employeeService.delete(deletingId);
      setShowDeleteConfirm(false);
      loadEmployees(currentPage, pageLimit);
    } catch (err: any) {
      setError(err.message || err.error || 'Failed to delete employee');
    } finally {
      setDeleting(false);
      setDeletingId(null);
      setDeletingName('');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingId(null);
    setDeletingName('');
  };

  // Open multiple upload modal
  const handleOpenMultipleUpload = () => {
    setUploadFile(null);
    setUploadError('');
    setUploadSuccess('');
    setUploadErrors([]);
    setShowMultipleUploadModal(true);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv'
      ];
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setUploadError('Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv).');
        setUploadFile(null);
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('File size exceeds 5MB limit.');
        setUploadFile(null);
        return;
      }
      
      setUploadFile(file);
      setUploadError('');
    }
  };

  // Download template for multiple employee upload
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setUploadError(''); // Clear any previous errors

      const response = await employeeService.downloadTemplate();
      if (response.success && response.data) {
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'employee_template.xlsx';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error(response.error || 'Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      setUploadError('Failed to download template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle multiple employee upload
  const handleMultipleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      setUploadSuccess('');
      setUploadErrors([]);

      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await employeeService.createMultiple(formData);

      if (response.success) {
        setUploadSuccess(response.message || 'Employees created successfully!');
        dispatchToast('success', response.message || 'Employees created successfully!');
        setTimeout(() => {
          setShowMultipleUploadModal(false);
          loadEmployees(currentPage, pageLimit);
        }, 2000);
      } else {
        // Show error modal instead of toast
        setErrorModalTitle('Upload Failed');
        setErrorModalMessage(response.message || 'Failed to create employees.');
        setErrorModalErrors(response.errors || []);
        setShowErrorModal(true);
      }
    } catch (err: any) {
      let errorMessage = 'Failed to upload employees. Please try again.';
      let errorList: any[] = [];
      
      if (err.message && (err.message.includes('Network') || err.message.includes('Failed to fetch'))) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (err.error) {
        errorMessage = err.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Get errors array from error object if available
      if (err.errors && Array.isArray(err.errors)) {
        errorList = err.errors;
      }
      
      // Show error modal for catch errors
      setErrorModalTitle('Upload Failed');
      setErrorModalMessage(errorMessage);
      setErrorModalErrors(errorList);
      setShowErrorModal(true);
    } finally {
      setUploading(false);
    }
  };





  // Helper mapping function to get unit name from ID securely
  const getUnitNameDisplay = (employee: Employee) => {
    // Determine the raw unit value
    const rawUnitVal = employee.department_unit || 
      (employee.department && typeof employee.department === 'object' && (employee.department as any).department_unit);
    
    if (!rawUnitVal || rawUnitVal === 'Not specified') return '-';
    
    // If it's already an object that contains the name, use it
    if (typeof rawUnitVal === 'object' && (rawUnitVal as any).department_name) {
      return (rawUnitVal as any).department_name;
    }

    // Treat it as an ID string and perform a deep search in allDepartments
    const searchId = String(rawUnitVal).trim();
    
    // Find the matching department by ID
    const matchedDept = allDepartments.find(d => 
      String(d._id) === searchId || String(d.department_id) === searchId
    );

    // Return the name if found, otherwise fallback to the raw ID (or '-')
    return matchedDept?.department_name || searchId;
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
        <div className="flex gap-3">
          <button
            onClick={handleNewEmployee}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Add Employee
          </button>
          <button
            onClick={handleOpenMultipleUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Add Multiple Employee
          </button>
        </div>
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
              onChange={(e) => {
                const query = e.target.value;
                setSearchQuery(query);

                // Clear existing timeout
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }

                // Set new timeout for debounced search
                searchTimeoutRef.current = setTimeout(() => {
                  handleSearch(query);
                }, 500); // 500ms debounce
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
              }
              loadEmployees(1, pageLimit);
            }}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
            title="Clear search and refresh"
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
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
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
                  Unit
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
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                        {employee.department_name || (employee.department && typeof employee.department === 'object' && (employee.department as any)?.department_name) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 font-medium">
                        {/* 👉 FIX: Calls the robust mapper function */}
                        {getUnitNameDisplay(employee)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalEmployees)} of {totalEmployees} employees
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newPage = currentPage - 1;
                  setCurrentPage(newPage);
                  loadEmployees(newPage, pageLimit);
                }}
                disabled={currentPage <= 1 || loading}
                className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1"
              >
                {loading && (
                  <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Previous
              </button>
              <button
                onClick={() => {
                  const newPage = currentPage + 1;
                  setCurrentPage(newPage);
                  loadEmployees(newPage, pageLimit);
                }}
                disabled={currentPage >= totalPages || loading}
                className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1"
              >
                Next
                {loading && (
                  <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - No close button, clicking outside won't close */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg sm:max-w-xl md:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl transform animate-scaleIn m-3 sm:m-6">
            
            <div className="p-5 border-b bg-gray-50 sticky top-0 flex items-center justify-between z-10">
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
                          department_id: selectedDept?._id || '',
                          department_unit: '' // reset unit when parent changes
                        });
                        
                        if (selectedDept?._id) {
                          setLoadingUnits(true);
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
                      Department Unit (Optional)
                    </label>
                    <select
                      value={formData.department_unit || ''}
                      onChange={(e) => setFormData({ ...formData, department_unit: e.target.value })}
                      disabled={!formData.department_id || loadingUnits}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      {loadingUnits ? (
                        <option value="">Loading units...</option>
                      ) : departmentUnits.length === 0 ? (
                        <option value="">No units available</option>
                      ) : (
                        <>
                          <option value="">Select department unit</option>
                          {departmentUnits.map((unit) => (
                            <option key={unit._id || unit.department_id} value={unit._id || unit.department_id}>
                              {unit.department_name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {formData.department_id && departmentUnits.length === 0 && !loadingUnits && (
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
                        setFormData({
                          ...formData,
                          roles: {
                            role_name: e.target.value,
                            permissions: [] // Permissions will be set automatically by backend
                          }
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {roles.length > 0 ? (
                        roles.map((role: RoleFromBackend) => (
                          <option key={role._id || role.role_name} value={role.role_name}>
                            {role.role_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </option>
                        ))
                      ) : (
                        <option value="">No roles available</option>
                      )}
                    </select>
                  </div>
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

      {/* Multiple Employee Upload Modal */}
      {showMultipleUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl transform animate-scaleIn m-3 sm:m-6">
            
            <div className="p-5 border-b bg-gray-50 sticky top-0 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <FiPlus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Add Multiple Employees
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload an Excel or CSV file to create multiple employees at once
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMultipleUploadModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Close"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleMultipleUpload(); }} className="p-5 space-y-5">
              {/* Success Message */}
              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
                  <FiCheck className="w-5 h-5 flex-shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
                              {/* File Format Info */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-blue-900">File Format Requirements:</h4>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {downloadingTemplate ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <FiPlus className="w-3 h-3" />
                        Download Template
                      </>
                    )}
                  </button>
                </div>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• <strong>Name columns:</strong> Use "fullname" OR both "firstname" + "lastname"</li>
                  <li>• <strong>Required columns:</strong> telephone, email, gender</li>
                  <li>• <strong>Optional columns:</strong> department, department_unit, role</li>
                  <li>• <strong>Gender options:</strong> Male, Female, Other, Not specified</li>
                  <li>• <strong>Email format:</strong> example@domain.com</li>
                  <li>• <strong>Telephone:</strong> At least 10 digits</li>
                  <li>• <strong>Roles:</strong> Will be automatically validated against system roles</li>
                  <li>• <strong>Departments:</strong> Must exist in the system and be properly related</li>
                </ul>
              </div>
              
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <FiPlus className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {uploadFile ? uploadFile.name : 'Click to select file or drag and drop'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Excel (.xlsx, .xls) or CSV (.csv) - Max 5MB
                      </span>
                    </div>
                  </label>
                </div>
                {uploadFile && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <FiCheck className="w-3 h-3" />
                    File selected: {uploadFile.name}
                  </p>
                )}
              </div>









              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMultipleUploadModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !!uploadSuccess}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
                    uploadSuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } ${uploading || !uploadFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : uploadSuccess ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiCheck className="w-4 h-4" />
                      Uploaded!
                    </span>
                  ) : 'Upload Employees'}
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

      {/* Error Modal for Multiple Upload */}
      <ErrorModal
        isOpen={showErrorModal}
        title={errorModalTitle}
        message={errorModalMessage}
        errors={errorModalErrors}
        onClose={() => setShowErrorModal(false)}
        type="error"
      />
    </div>
    </MainLayout>
  );
};

export default EmployeesPage;