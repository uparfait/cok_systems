// DepartmentsPage - Admin Department Management
// Page for managing departments in the COK Systems

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { departmentService } from '../../../core/services/adminService';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiArrowLeft, 
  FiCheck, FiX, FiRefreshCw, FiUsers, FiGrid
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string;
  description?: string;
  head?: string;
  employees?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DepartmentsPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Department>>({
    department_name: '',
    department_id: '',
    department_leader: '',
  });

  // Check auth and load departments
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadDepartments();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load departments
  const loadDepartments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await departmentService.getAll();
      
      if (response.status) {
        setDepartments(response.data || []);
      } else {
        setError(response.error || 'Failed to load departments');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading departments');
    } finally {
      setLoading(false);
    }
  };

  // Search departments
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDepartments();
      return;
    }

    try {
      setLoading(true);
      const response = await departmentService.search(searchQuery);
      
      if (response.status) {
        setDepartments(response.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
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
      description: '',
    });
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      department_name: department.department_name || '',
      department_id: department.department_id || '',
      department_leader: department.department_leader || '',
    });
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError('');

      if (editingDepartment?._id || editingDepartment?.department_id) {
        // Update existing
        const id = editingDepartment._id || editingDepartment.department_id || '';
        await departmentService.update(id, formData);
      } else {
        // Create new
        await departmentService.create(formData);
      }

      setShowModal(false);
      loadDepartments();
    } catch (err: any) {
      setError(err.message || 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      setLoading(true);
      await departmentService.delete(id);
      loadDepartments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete department');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading departments...</p>
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
            <HiOutlineOfficeBuilding className="w-8 h-8 text-blue-600" />
            Departments
          </h1>
          <p className="text-gray-500 mt-1">Manage departments in the organization</p>
        </div>
        <button
          onClick={handleNewDepartment}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          Add Department
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Search
          </button>
          <button
            onClick={loadDepartments}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FiGrid className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No departments found</p>
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept._id || dept.department_id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  dept.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {dept.status || 'Active'}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{dept.department_name || 'Unnamed Department'}</h3>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <FiUsers className="w-4 h-4" />
                  {dept.employees || 0} employees
                </span>
                {dept.department_leader && <span>Leader: {dept.department_leader}</span>}
              </div>
              
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(dept)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(dept._id || dept.department_id || '')}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingDepartment ? 'Edit Department' : 'Add Department'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Department Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.department_name}
                  onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter department name"
                />
              </div>
              
              {/* Department ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., DEPT-001"
                />
              </div>
              
              {/* Department Leader */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Leader (Email)
                </label>
                <input
                  type="email"
                  value={formData.department_leader}
                  onChange={(e) => setFormData({ ...formData, department_leader: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="leader@company.com"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingDepartment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsPage;
