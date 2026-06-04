// DepartmentsPage - Admin Department Management with Professional Table
// Clean modern design with table layout

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { departmentService, employeeService, normalizeDepartments, type Department, type Employee } from '../../../core/services/adminService';
import DepartmentManagementTable from '../components/DepartmentManagementTable';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiPlus, FiSearch, FiRefreshCw,
  FiCheck, FiAlertCircle
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

const DepartmentsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
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

  const [formData, setFormData] = useState<Partial<Department>>({
    name: '',
    description: '',
    room_number: '',
    leader: null,
    services: [],
  });

  // Clear messages when modal opens/closes
  useEffect(() => {
    if (showModal) {
      setFormError('');
      setFormSuccess('');
    }
  }, [showModal]);

  // Load departments and employees
  const loadDepartments = useCallback(async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) {
        setFirstLoad(true);
      }
      setLoading(true);
      setError('');
      
      const [deptResponse, empResponse] = await Promise.all([
        departmentService.getAll(),
        employeeService.getAll()
      ]);
      
      if (deptResponse?.success) {
        const rawData = Array.isArray(deptResponse.data) 
          ? deptResponse.data 
          : (deptResponse.data?.data || []);
        setDepartments(normalizeDepartments(rawData));
      } else if (deptResponse) {
        setError(deptResponse.message || deptResponse.error || 'Failed to load departments');
      }
      
      if (empResponse?.success) {
        const empData = Array.isArray(empResponse.data) 
          ? empResponse.data 
          : (empResponse.data?.data || []);
        setEmployees(empData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading data');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  // Check auth and load data
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadDepartments(true);
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname, loadDepartments]);

  const filteredDepartments = useMemo(() => {
    let filtered = departments.filter(dept => !dept.is_unit);
    
    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dept =>
        (dept.name?.toLowerCase().includes(query)) ||
        (dept.description?.toLowerCase().includes(query)) ||
        (dept.room_number?.toLowerCase().includes(query)) ||
        (typeof dept.leader === 'string' && dept.leader?.toLowerCase().includes(query)) ||
        (typeof dept.leader === 'object' && dept.leader?.full_name?.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [departments, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return departments.filter(dept => !dept.is_unit).length;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Open modal for new department
  const handleNewDepartment = () => {
    setEditingDepartment(null);
    setFormData({
      name: '',
      description: '',
      room_number: '',
      leader: '',
      services: [],
    });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (department: Department) => {
    let leaderId: string = '';
    const leader = department.leader || department.department_leader;
    if (leader) {
      if (typeof leader === 'string') leaderId = leader;
      else if (typeof leader === 'object') leaderId = (leader as { _id?: string })._id || '';
    }
    
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      description: department.description || '',
      room_number: department.room_number || '',
      leader: leaderId,
      services: department.services || [],
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
    
    if (!formData?.name?.trim()) {
      setFormError('Department name is required');
      return;
    }

    try {
      setSubmitting(true);

      const submitData: any = {
        name: formData?.name,
        description: formData?.description || '',
        room_number: formData?.room_number || '',
        leader: formData?.leader || null,
        services: formData?.services || [],
      };

      if (editingDepartment?._id) {
        const response = await departmentService.update(editingDepartment._id, submitData);
        
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save department');
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
      loadDepartments(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    } finally {
      setDeleting(false);
      setDeletingId(null);
      setDeletingName('');
    }
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
          <div className="mt-6 inline-flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
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

        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search departments..."
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

        {/* Departments Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading && firstLoad ? (
            <div className="p-12 text-center">
              <div className="flex justify-center items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-500">Loading departments...</span>
              </div>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="p-12 text-center">
              <HiOutlineOfficeBuilding className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No departments found</h3>
              <p className="text-gray-500">
                {searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first department'}
              </p>
            </div>
          ) : (
            <DepartmentManagementTable 
              departments={filteredDepartments}
              employees={employees}
              loading={loading}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              refreshDepartments={() => loadDepartments(false)}
            />
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform animate-scaleIn overflow-hidden">
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
                  <input
                    type="text"
                    required
                    value={formData?.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter department name"
                  />
                </div>
                
                {/* Room Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={formData?.room_number || ''}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 101, 2nd Floor"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData?.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter department description"
                    rows={3}
                  />
                </div>
                
                {/* Department Leader */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Department Leader
                  </label>
                  <select
                    value={typeof formData?.leader === 'string' ? formData?.leader : ''}
                    onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No leader assigned</option>
                    {employees.map((emp) => (
                      <option key={emp._id || emp.employee_id} value={emp._id || emp.employee_id || ''}>
                        {emp.full_name} ({emp.email})
                      </option>
                    ))}
                  </select>
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
          onCancel={() => setShowDeleteConfirm(false)}
          type="danger"
          isLoading={deleting}
        />
      </div>
    </MainLayout>
  );
};

export default DepartmentsPage;
