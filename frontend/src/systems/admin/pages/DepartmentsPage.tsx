// DepartmentsPage - Admin Department Management
// Page for managing departments in the COK Systems
// Clean modern design without status filters

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { departmentService, employeeService, type Employee } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiRefreshCw, FiUsers, FiGrid,
  FiX, FiCheck, FiAlertCircle, FiLayers, FiEye
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

interface DepartmentLeader {
  _id?: string;
  full_name?: string;
  email?: string;
  title?: string;
  picture?: string;
}

interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string | DepartmentLeader | null;
  description?: string;
  head?: string;
  employees?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  department_response_time_in_minutes?: number;
  sub_department_mng?: {
    is_sub_department: boolean;
    parent_department_id: string;
  };
}

const DepartmentsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Used to detect when the user explicitly navigates to this page
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  
  // Form-level error and success states
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Department unit modal state
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedDepartmentForUnit, setSelectedDepartmentForUnit] = useState<Department | null>(null);
  const [unitFormData, setUnitFormData] = useState({
    department_name: '',
    department_id: '',
    department_leader: '',
  });
  const [unitFormError, setUnitFormError] = useState('');
  const [unitFormSuccess, setUnitFormSuccess] = useState('');
  const [submittingUnit, setSubmittingUnit] = useState(false);

  // Department details panel state
  const [showDepartmentDetails, setShowDepartmentDetails] = useState(false);
  const [selectedDepartmentForDetails, setSelectedDepartmentForDetails] = useState<Department | null>(null);
  const [departmentUnits, setDepartmentUnits] = useState<Department[]>([]);
  const [departmentEmployees, setDepartmentEmployees] = useState<Employee[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Department>>({
    department_name: '',
    department_id: '',
    department_leader: '',
    department_response_time_in_minutes: 0,
  });

  // Clear messages when modal opens/closes
  useEffect(() => {
    if (showModal) {
      setFormError('');
      setFormSuccess('');
    }
  }, [showModal]);

  // Load departments and employees
  // Wrapped in useCallback so it can be safely used in useEffect dependencies
  const loadDepartments = useCallback(async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) {
        setfirstLoad(true);
      }
      setLoading(true);
      setError('');
      
      // Load both departments and employees in parallel
      const [deptResponse, empResponse] = await Promise.all([
        departmentService.getAll(),
        employeeService.getAll()
      ]).catch((err) => {
        console.error('Promise.all error:', err);
        throw err;
      });
      
      if (deptResponse?.success) {
        const deptData = Array.isArray(deptResponse.data) 
          ? deptResponse.data 
          : (deptResponse.data?.data || []);
        setDepartments(deptData);
      } else if (deptResponse) {
        setError(deptResponse.message || deptResponse.error || 'Failed to load departments');
      }
      
      if (empResponse?.success) {
        const empData = Array.isArray(empResponse.data) 
          ? empResponse.data 
          : (empResponse.data?.data || []);
        setEmployees(empData);
      }
    } catch (err: any) {
      setError(err?.message || err?.error || 'An error occurred while loading data');
    } finally {
      setLoading(false);
      setfirstLoad(false); // Ensure first load is cleared after fetching finishes
    }
  }, []);

  // Check auth and force load data when the component mounts or the route changes to this page
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      // Force a fresh initial load
      loadDepartments(true);
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname, loadDepartments]);

  // Calculate employee count for each department
  const getEmployeeCount = (departmentName?: string) => {
    if (!departmentName) return 0;
    return employees.filter((emp: any) => 
      emp.department === departmentName || 
      emp.department?.department_name === departmentName
    ).length;
  };

  const filteredDepartments = useMemo(() => {
    // ONLY show main departments in the grid, hide sub-departments
    let filtered = departments.filter(dept => !dept.sub_department_mng?.is_sub_department);
    
    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dept =>
        (dept.department_name?.toLowerCase().includes(query)) ||
        (dept.department_id?.toLowerCase().includes(query)) ||
        (typeof dept.department_leader === 'string' && dept.department_leader?.toLowerCase().includes(query)) ||
        (typeof dept.department_leader === 'object' && dept.department_leader?.full_name?.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [departments, searchQuery]);

  // Statistics (only counting parent departments)
  const stats = useMemo(() => {
    return departments.filter(dept => !dept.sub_department_mng?.is_sub_department).length;
  }, [departments]);

  // Search departments
  const handleSearch = async () => {
    if (!searchQuery?.trim()) {
      loadDepartments(false);
      return;
    }

    try {
      setLoading(true);
      const response = await departmentService?.search(searchQuery);
      
      if (response.success) {
        setDepartments(response.data || []);
      } else {
        setError(response.message || response.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message || err.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Open modal for new department
  const handleNewDepartment = () => {
    setEditingDepartment(null);
    setFormData({
      department_name: '',
      department_id: '',
      department_leader: '',
      department_response_time_in_minutes: 0,
    });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (department: Department) => {
    let leaderEmail = '';
    if (department.department_leader) {
      if (typeof department.department_leader === 'string') {
        leaderEmail = department.department_leader;
      } else if (typeof department.department_leader === 'object') {
        leaderEmail = (department.department_leader as any).email || '';
      }
    }
    
    setEditingDepartment(department);
    setFormData({
      department_name: department.department_name || '',
      department_id: department.department_id || '',
      department_leader: leaderEmail,
      department_response_time_in_minutes: department.department_response_time_in_minutes || 0,
    });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormError('');
    setFormSuccess('');
    
    if (!formData?.department_name?.trim() || !formData?.department_id?.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      let submitData: any;
      
      if (editingDepartment?._id || editingDepartment?.department_id) {
        let leaderValue: string | undefined = undefined;
        if (formData?.department_leader && typeof formData?.department_leader === 'string' && formData?.department_leader.trim()) {
          leaderValue = formData?.department_leader?.trim();
        }
        
        submitData = {
          department_name: formData?.department_name,
          department_id: formData?.department_id,
          department_response_time_in_minutes: formData?.department_response_time_in_minutes ?? 0,
          department_leader: leaderValue
        };
      } else {
        let leaderValue: string | undefined = undefined;
        if (formData?.department_leader && typeof formData?.department_leader === 'string' && formData?.department_leader.trim()) {
          leaderValue = formData?.department_leader?.trim();
        }
        
        submitData = {
          department_name: formData?.department_name,
          department_id: formData?.department_id,
          department_leader: leaderValue,
          department_response_time_in_minutes: formData?.department_response_time_in_minutes ?? 0
        };
      }

      if (editingDepartment?._id || editingDepartment?.department_id) {
        const id = editingDepartment._id || editingDepartment.department_id || '';
        const response = await departmentService.update(id, submitData);
        
        if (response.success) {
          setFormSuccess(response.message || 'Department updated successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadDepartments(false);
          }, 1500);
        } else {
          setFormError(response.message || response.error || 'Failed to update department');
        }
      } else {
        const response = await departmentService.create(submitData);
        
        if (response.success) {
          setFormSuccess(response.message || 'Department created successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadDepartments(false);
          }, 1500);
        } else {
          setFormError(response.message || response.error || 'Failed to create department');
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Network') || err.message.includes('Failed to fetch'))) {
        setFormError('Cannot connect to server. Please check your internet connection and try again.');
      } else {
        setFormError(err.message || err.error || 'Failed to save department. Please try again.');
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
      await departmentService.delete(deletingId);
      setShowDeleteConfirm(false);
      
      // If we deleted a unit while the details panel is open, close the panel
      if (showDepartmentDetails && departmentUnits.some(u => u._id === deletingId || u.department_id === deletingId)) {
        handleCloseDetails();
      }

      loadDepartments(false);
    } catch (err: any) {
      setError(err.message || err.error || 'Failed to delete department');
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

  const handleAddUnit = (department: Department) => {
    setSelectedDepartmentForUnit(department);
    setUnitFormData({
      department_name: '',
      department_id: '',
      department_leader: '',
    });
    setUnitFormError('');
    setUnitFormSuccess('');
    setShowUnitModal(true);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setUnitFormError('');
    setUnitFormSuccess('');
    
    if (!unitFormData.department_name.trim() || !unitFormData.department_id.trim()) {
      setUnitFormError('Please fill in all required fields');
      return;
    }

    if (!selectedDepartmentForUnit) {
      setUnitFormError('No department selected');
      return;
    }

    try {
      setSubmittingUnit(true);

      let leaderValue: string | undefined = undefined;
      if (unitFormData.department_leader && unitFormData.department_leader.trim()) {
        leaderValue = unitFormData.department_leader.trim();
      }

      const submitData = {
        department_name: unitFormData.department_name,
        department_id: unitFormData.department_id,
        department_leader: leaderValue,
        sub_department_mng: {
          is_sub_department: true,
          parent_department_id: selectedDepartmentForUnit._id || selectedDepartmentForUnit.department_id
        }
      };

      const response = await departmentService.create(submitData);
      
      if (response.success) {
        setUnitFormSuccess(response.message || 'Department unit created successfully!');
        setTimeout(() => {
          setShowUnitModal(false);
          
          // Auto-refresh the details panel if it's currently open
          if (showDepartmentDetails && selectedDepartmentForDetails) {
            handleViewDetails(selectedDepartmentForDetails);
          } else {
            loadDepartments(false);
          }
        }, 1500);
      } else {
        setUnitFormError(response.message || response.error || 'Failed to create department unit');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Network') || err.message.includes('Failed to fetch'))) {
        setUnitFormError('Cannot connect to server. Please check your internet connection and try again.');
      } else {
        setUnitFormError(err.message || err.error || 'Failed to save department unit. Please try again.');
      }
    } finally {
      setSubmittingUnit(false);
    }
  };

  const handleViewDetails = async (department: Department) => {
    setSelectedDepartmentForDetails(department);
    setShowDepartmentDetails(true);
    setLoadingDetails(true);

    try {
      // Load department units (sub-departments)
      const allDepts = await departmentService.getAll();
      let units: Department[] = [];
      if (allDepts.success) {
        const deptData = Array.isArray(allDepts.data) 
          ? allDepts.data 
          : (allDepts.data?.data || []);
        
        units = deptData.filter((dept: any) => {
          return dept.sub_department_mng?.is_sub_department && 
                 dept.sub_department_mng?.parent_department_id === (department._id || department.department_id);
        });
        setDepartmentUnits(units);
      }

      // Load ALL employees and filter by parent AND units
      const allEmployees = await employeeService.getAll();
      if (allEmployees.success) {
        const empData = Array.isArray(allEmployees.data) 
          ? allEmployees.data 
          : (allEmployees.data?.data || []);
        
        const unitIds = units.map(u => String(u._id || u.department_id));
        const unitNames = units.map(u => String(u.department_name));

        const emps = empData.filter((emp: any) => {
          const empDeptName = String(emp.department_name || (typeof emp.department === 'object' ? emp.department?.department_name : emp.department));
          const empDeptId = String(emp.department_id || (typeof emp.department === 'object' ? emp.department?._id : ''));

          // Check if employee belongs to parent department
          const matchesParent = 
            empDeptName === String(department.department_name) || 
            (empDeptId && (empDeptId === String(department._id) || empDeptId === String(department.department_id)));

          // Check if employee belongs to any unit under this parent
          const matchesUnit = 
            (empDeptId && unitIds.includes(empDeptId)) || 
            (empDeptName && unitNames.includes(empDeptName));

          return matchesParent || matchesUnit;
        });

        setDepartmentEmployees(emps);
      }
    } catch (err: any) {
      console.error('Error loading department details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setShowDepartmentDetails(false);
    setSelectedDepartmentForDetails(null);
    setDepartmentUnits([]);
    setDepartmentEmployees([]);
  };

  // Reusable component to render an employee table group
  const renderEmployeeTable = (emps: Employee[], title: string, emptyMessage: string, keyPrefix: string) => (
    <div key={keyPrefix} className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <FiUsers className="w-5 h-5 text-blue-600" />
        {title} ({emps.length})
      </h3>
      {emps.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {emps.map((emp) => (
                <tr key={emp._id || emp.employee_id} className="hover:bg-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {(emp.full_name || 'E').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.full_name || '-'}</p>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600">{emp.telephone || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">
                      {emp.roles?.role_name ? emp.roles.role_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <HiOutlineOfficeBuilding className="w-8 h-8 text-blue-600" />
              Departments
            </h1>
            <p className="text-gray-500 mt-1">Manage departments in the organization</p>
          </div>
          <button
            onClick={handleNewDepartment}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors w-fit"
          >
            <FiPlus className="w-5 h-5" />
            Add Department
          </button>
        </div>

        {/* Statistics */}
        <div className="mt-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiGrid className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Departments</p>
              <p className="text-2xl font-bold text-gray-900">{stats}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments by name, ID, or leader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Search
            </button>
            <button
              onClick={() => loadDepartments(false)}
              className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
              title="Refresh"
            >
              <FiRefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(loading && firstLoad) ? (
          <div className="col-span-full">
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="flex justify-center items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-500">Loading departments...</span>
              </div>
            </div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full">
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiGrid className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No departments found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'Get started by adding your first department'
                }
              </p>
            </div>
          </div>
        ) : (
          filteredDepartments.map((dept) => (
            <div
              key={dept._id || dept.department_id}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow flex flex-col h-full"
            >
              {/* Header with icon */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              
              {/* Department Info */}
              <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                {dept.department_name || 'Unnamed Department'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                ID: {dept.department_id || 'N/A'}
              </p>
              
              {/* Stats */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center">
                    <FiUsers className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium">{getEmployeeCount(dept.department_name)}</span>
                  <span className="text-gray-400">employees</span>
                </div>
              </div>

              {/* Leader Info */}
              <div className="mb-6">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Department Leader</p>
                <p className="text-sm text-gray-700 font-medium truncate">
                  {dept.department_leader 
                    ? (typeof dept.department_leader === 'object' 
                        ? dept.department_leader.full_name || dept.department_leader.email 
                        : dept.department_leader)
                    : 'No leader assigned'
                  }
                </p>
              </div>
              
              {/* Action Buttons - Styled nicely like screenshots */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
                <button
                  onClick={() => handleViewDetails(dept)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <FiEye className="w-4 h-4" /> View
                </button>
                <button
                  onClick={() => handleAddUnit(dept)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <FiLayers className="w-4 h-4" /> Add Unit
                </button>
                <button
                  onClick={() => handleEdit(dept)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <FiEdit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(dept._id || dept.department_id || '', dept.department_name || 'this department')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform animate-scaleIn overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {editingDepartment ? 'Edit Department' : 'Add Department'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {editingDepartment ? 'Update department details' : 'Create a new department'}
                    </p>
                  </div>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

              {/* Department Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <HiOutlineOfficeBuilding className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData?.department_name}
                    onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter department name"
                  />
                </div>
              </div>
              
              {/* Department ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData?.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., DEPT-001"
                  />
                </div>
              </div>
              
              {/* Department Leader */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department Leader
                </label>
                <div className="relative">
                  <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={typeof formData?.department_leader === 'string' ? formData?.department_leader : ''}
                    onChange={(e) => setFormData({ ...formData, department_leader: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No leader assigned</option>
                    {employees.map((emp) => (
                      <option key={emp._id || emp.employee_id} value={emp.email}>
                        {emp.full_name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors ${
                    submitting
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : editingDepartment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Department"
        message={`Are you sure you want to delete "${deletingName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        type="danger"
        isLoading={deleting}
      />

      {/* Add Department Unit Modal */}
      {showUnitModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform animate-scaleIn overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <FiLayers className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Add Department Unit
                    </h2>
                    <p className="text-sm text-gray-500">
                      Create a new unit under {selectedDepartmentForUnit?.department_name}
                    </p>
                  </div>
                </div>
            </div>
            
            <form onSubmit={handleUnitSubmit} className="p-6 space-y-5">
              {/* Inline Error Message */}
              {unitFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{unitFormError}</span>
                </div>
              )}

              {/* Inline Success Message */}
              {unitFormSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{unitFormSuccess}</span>
                </div>
              )}

              {/* Department Unit Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <HiOutlineOfficeBuilding className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={unitFormData.department_name}
                    onChange={(e) => setUnitFormData({ ...unitFormData, department_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter unit name"
                  />
                </div>
              </div>
              
              {/* Department Unit ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={unitFormData.department_id}
                    onChange={(e) => setUnitFormData({ ...unitFormData, department_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., UNIT-001"
                  />
                </div>
              </div>
              
              {/* Department Unit Leader */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit Head
                </label>
                <div className="relative">
                  <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={unitFormData.department_leader}
                    onChange={(e) => setUnitFormData({ ...unitFormData, department_leader: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">No head assigned</option>
                    {employees.map((emp) => (
                      <option key={emp._id || emp.employee_id} value={emp.email}>
                        {emp.full_name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  disabled={submittingUnit}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors ${
                    submittingUnit
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUnit}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {submittingUnit ? (
                    <span className="flex items-center justify-center gap-2">
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Details Panel */}
      {showDepartmentDetails && selectedDepartmentForDetails && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl transform animate-scaleIn"
          >
            {/* Panel Header */}
            <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedDepartmentForDetails.department_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    ID: {selectedDepartmentForDetails.department_id || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetails}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Close"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Loading details...</span>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Department Units Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FiLayers className="w-5 h-5 text-purple-600" />
                        Department Units ({departmentUnits.length})
                      </h3>
                      <button
                        onClick={() => {
                          handleCloseDetails();
                          handleAddUnit(selectedDepartmentForDetails);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Unit
                      </button>
                    </div>
                    {departmentUnits.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
                        <FiLayers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No department units found</p>
                        <p className="text-sm text-gray-400 mt-1">Click "Add Unit" to create one</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {departmentUnits.map((unit) => (
                          <div key={unit._id || unit.department_id} className="bg-purple-50/50 rounded-xl p-5 border border-purple-100 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-gray-900 text-lg mb-1">{unit.department_name}</h4>
                                <p className="text-sm text-gray-500 mb-2">ID: {unit.department_id || 'N/A'}</p>
                                <p className="text-sm text-gray-600 font-medium bg-white px-3 py-1.5 rounded-lg border border-purple-50 inline-block">
                                  Head: {unit.department_leader 
                                    ? (typeof unit.department_leader === 'object' 
                                        ? unit.department_leader.full_name || unit.department_leader.email 
                                        : unit.department_leader)
                                    : 'No head assigned'
                                  }
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    handleCloseDetails();
                                    handleEdit(unit);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Edit Unit"
                                >
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    handleCloseDetails();
                                    handleDeleteClick(unit._id || unit.department_id || '', unit.department_name || 'this unit');
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete Unit"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 
                    GROUPED EMPLOYEES SECTION
                    1. Main Department Employees
                    2. Iteration of Unit Employees
                  */}
                  <div className="border-t border-gray-100 pt-6">
                    
                    {/* Main Department Employees */}
                    {renderEmployeeTable(
                      departmentEmployees.filter(emp => {
                        const empDeptName = String(emp.department_name || (typeof emp.department === 'object' ? emp.department?.department_name : emp.department));
                        const empDeptId = String(emp.department_id || (typeof emp.department === 'object' ? emp.department?._id : ''));
                        return empDeptName === String(selectedDepartmentForDetails.department_name) || 
                               (empDeptId && (empDeptId === String(selectedDepartmentForDetails._id) || empDeptId === String(selectedDepartmentForDetails.department_id)));
                      }),
                      'Employees',
                      'No main employees found in this department',
                      'main-employees'
                    )}

                    {/* Unit Employees */}
                    {departmentUnits.map((unit) => {
                      const unitEmps = departmentEmployees.filter(emp => {
                        const empDeptName = String(emp.department_name || (typeof emp.department === 'object' ? emp.department?.department_name : emp.department));
                        const empDeptId = String(emp.department_id || (typeof emp.department === 'object' ? emp.department?._id : ''));
                        return empDeptName === String(unit.department_name) || 
                               (empDeptId && (empDeptId === String(unit._id) || empDeptId === String(unit.department_id)));
                      });

                      return renderEmployeeTable(
                        unitEmps,
                        `Employees (${unit.department_name})`,
                        `No employees assigned to ${unit.department_name}`,
                        `unit-employees-${unit._id || unit.department_id}`
                      );
                    })}

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </MainLayout>
  );
};

export default DepartmentsPage;