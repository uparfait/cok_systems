// DepartmentsPage - Admin Department Management
// Page for managing departments in the COK Systems
// Clean modern design without status filters

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { departmentService, employeeService, type Employee } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiRefreshCw, FiUsers, FiGrid,
  FiX, FiCheck, FiAlertCircle
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
}

const DepartmentsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
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

  // Check auth and load departments
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadDepartments();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load departments and employees
  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading departments and employees...');
      
      // Load both departments and employees in parallel
      const [deptResponse, empResponse] = await Promise.all([
        departmentService.getAll(),
        employeeService.getAll()
      ]).catch((err) => {
        console.error('Promise.all error:', err);
        throw err;
      });
      
      console.log('Departments response:', deptResponse);
      console.log('Employees response:', empResponse);
      
      // Note: Backend returns 'success' not 'status'
      if (deptResponse?.success) {
        console.log('Departments raw data:', deptResponse.data);
        // Handle both array response and object with data property
        const deptData = Array.isArray(deptResponse.data) 
          ? deptResponse.data 
          : (deptResponse.data?.data || []);
        console.log('Departments processed:', deptData);
        console.log('First department item:', deptData[0]);
        setDepartments(deptData);
      } else if (deptResponse) {
        console.error('Department response failed:', deptResponse);
        // Use backend message with priority
        setError(deptResponse.message || deptResponse.error || 'Failed to load departments');
      }
      
      if (empResponse?.success) {
        console.log('Employees raw data:', empResponse.data);
        // Handle both array response and object with data property
        const empData = Array.isArray(empResponse.data) 
          ? empResponse.data 
          : (empResponse.data?.data || []);
        console.log('Employees processed:', empData);
        setEmployees(empData);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      setError(err?.message || err?.error || 'An error occurred while loading data');
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
      setfirstLoad(false);
      console.log('Loading is now false, departments state:', departments.length);
    }
  };

  // Calculate employee count for each department
  const getEmployeeCount = (departmentName?: string) => {
    if (!departmentName) return 0;
    return employees.filter((emp: any) => 
      emp.department === departmentName || 
      emp.department?.department_name === departmentName
    ).length;
  };
  const filteredDepartments = useMemo(() => {
    let filtered = departments;
    
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

  // Statistics
  const stats = useMemo(() => {
    return departments.length;
  }, [departments]);

  // Search departments
  const handleSearch = async () => {
    if (!searchQuery?.trim()) {
      loadDepartments();
      return;
    }

    try {
      setLoading(true);
      const response = await departmentService?.search(searchQuery);
      
      if (response.success) {
        setDepartments(response.data || []);
      } else {
        // Use backend message with priority
        setError(response.message || response.error || 'Search failed');
      }
    } catch (err: any) {
      // Use backend message with priority
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
    // Extract email from department_leader if it's an object
    let leaderEmail = '';
    if (department.department_leader) {
      if (typeof department.department_leader === 'string') {
        leaderEmail = department.department_leader;
      } else if (typeof department.department_leader === 'object') {
        // It's an object with email property
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
    
    // Clear previous messages
    setFormError('');
    setFormSuccess('');
    
    // Validate form data
    if (!formData?.department_name?.trim() || !formData?.department_id?.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare data - send appropriate fields based on create vs update
      let submitData: any;
      
      if (editingDepartment?._id || editingDepartment?.department_id) {
        // Update existing - only send fields that backend accepts
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
        // Create new - send all required fields
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
      
      console.log('Submitting department data:', submitData);

      if (editingDepartment?._id || editingDepartment?.department_id) {
        // Update existing
        const id = editingDepartment._id || editingDepartment.department_id || '';
        const response = await departmentService.update(id, submitData);
        console.log('Update response:', response);
        
        if (response.success) {
          setFormSuccess(response.message || 'Department updated successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadDepartments();
          }, 1500);
        } else {
          setFormError(response.message || response.error || 'Failed to update department');
        }
      } else {
        // Create new
        const response = await departmentService.create(submitData);
        console.log('Create response:', response);
        
        if (response.success) {
          setFormSuccess(response.message || 'Department created successfully!');
          setTimeout(() => {
            setShowModal(false);
            loadDepartments();
          }, 1500);
        } else {
          setFormError(response.message || response.error || 'Failed to create department');
        }
      }
    } catch (err: any) {
      console.error('Department save error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      
      // Check if it's a network error
      if (err.message && (err.message.includes('Network') || err.message.includes('Failed to fetch'))) {
        setFormError('Cannot connect to server. Please check your internet connection and try again.');
      } else if (err.error) {
        // Use backend message with priority
        setFormError(err.message || err.error);
      } else if (err.message) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save department. Please try again.');
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
      await departmentService.delete(deletingId);
      setShowDeleteConfirm(false);
      loadDepartments();
    } catch (err: any) {
      // Use backend message with priority
      setError(err.message || err.error || 'Failed to delete department');
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
              {(loading && firstLoad) ? (
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats}</p>
              )}
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
              onClick={loadDepartments}
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
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
            >
              {/* Header with icon */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <HiOutlineOfficeBuilding className="w-7 h-7 text-blue-600" />
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
              <div className="mb-4">
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
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(dept)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(dept._id || dept.department_id || '', dept.department_name || 'this department')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete
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
    </div>
    </MainLayout>
  );
};

export default DepartmentsPage;

