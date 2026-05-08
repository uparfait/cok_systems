// VisitorDetailsPage - Comprehensive visitor details and editing page
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiRefreshCw, FiCheckCircle, FiClock, FiX, FiLoader, FiSave, FiEdit3, FiPlus } from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import { getTasks } from '../../../core/services/taskService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import CreateTaskModal from '../../taskManagement/components/CreateTaskModal';

// Validation helper functions (from CheckInPersonPage)
const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === '') {
    return null; // Optional field - no validation needed
  }

  const trimmedId = idNumber.trim();

  if (idType === 'National ID') {
    // National ID must be 16 characters
    if (trimmedId.length !== 16) {
      return 'National ID must be 16 digits';
    }
    // National ID should only contain numbers (Egyptian national ID format)
    if (!/^\d+$/.test(trimmedId)) {
      return 'National ID must contain only numbers';
    }
  } else if (idType === 'Passport') {
    // Passport typically 6-9 characters with letters and numbers
    if (trimmedId.length < 6) {
      return 'Passport number must be at least 6 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Passport number must contain only letters and numbers';
    }
  } else if (idType === 'Driving Licence') {
    // Driving licence typically 8-15 characters
    if (trimmedId.length < 8) {
      return 'Driving Licence must be at least 8 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Driving Licence must contain only letters and numbers';
    }
  }

  return null; // Valid
};

// Email validation helper
const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return null; // Optional field - no validation needed
  }

  const trimmedEmail = email.trim();
  // General email regex - accepts any valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }

  return null; // Valid
};

const VisitorDetailsPage: React.FC = () => {
  const { visitorId } = useParams<{ visitorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Handle input changes with validation
  const handleInputChange = (field: string, value: string) => {
    const updateNestedObject = (obj: any, path: string, val: string) => {
      const keys = path.split('.');
      const lastKey = keys.pop()!;
      const target = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
      target[lastKey] = val;
      return { ...obj };
    };

    const updatedVisitor = field.includes('.')
      ? updateNestedObject(editingVisitor, field, value)
      : { ...editingVisitor, [field]: value };

    setEditingVisitor(updatedVisitor);

    // Validate ID number when id_type or id_number changes
    if (field === 'identification.id_type' || field === 'identification.number') {
      const currentIdentification = field.includes('.')
        ? updateNestedObject(editingVisitor, field, value).identification
        : editingVisitor.identification;
      const newIdType = currentIdentification?.id_type || '';
      const newIdNumber = currentIdentification?.number || '';
      const error = validateIdNumber(newIdType, newIdNumber);
      setIdError(error);
    }

    // Validate email when email changes
    if (field === 'email') {
      const error = validateEmail(value);
      setEmailError(error);
    }
  };

  const [visitor, setVisitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [visitorTasks, setVisitorTasks] = useState<any[]>([]);

  // Load visitor data
  useEffect(() => {
    const loadVisitor = async () => {
      if (!visitorId) {
        showError('Visitor ID not provided');
        navigate('/service-delivery/employee');
        return;
      }

      try {
        setLoading(true);
        const response = await serviceDeliveryService.getById(visitorId);

        if (response.success && response.data) {
          setVisitor(response.data);
          setEditingVisitor({ ...response.data });

          // Fetch tasks that belong to this visitor
          try {
            const tasksResponse = await getTasks();
            if (tasksResponse.success) {
              const tasks = tasksResponse.data.tasks.filter((task: any) =>
                task.belongs?.isBelongsTo && task.belongs.itBelongsTo === visitorId
              );
              setVisitorTasks(tasks);
            }
          } catch (error) {
            console.error('Error fetching visitor tasks:', error);
          }
        } else {
          showError(response.message || 'Failed to load visitor details');
          navigate('/service-delivery/employee');
        }
      } catch (error: any) {
        console.error('Error loading visitor:', error);
        showError(error.message || 'Failed to load visitor details');
        navigate('/service-delivery/employee');
      } finally {
        setLoading(false);
      }
    };

    loadVisitor();
  }, [visitorId, navigate, showError]);

  const handleUpdateVisitor = async () => {
    if (!editingVisitor || !visitor) return;

    // Validate required fields
    if (!editingVisitor.full_name || !editingVisitor.telephone) {
      showError('Please fill in required fields (Full Name and Telephone)');
      return;
    }

    // Validate ID number
    const idValidationError = validateIdNumber(
      editingVisitor.identification?.id_type || '',
      editingVisitor.identification?.number || ''
    );
    if (idValidationError) {
      showError(idValidationError);
      return;
    }

    // Validate email if provided
    const emailValidationError = validateEmail(editingVisitor.email || '');
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    setUpdating(true);
    try {
      const updateData = {
        full_name: editingVisitor.full_name,
        telephone: editingVisitor.telephone,
        email: editingVisitor.email,
        gender: editingVisitor.gender,
        identification: editingVisitor.identification
      };

      const response = await serviceDeliveryService.update(visitor._id, updateData);

      if (response.success) {
        setVisitor({ ...visitor, ...response.data });
        setEditingVisitor({ ...response.data });
        setIsEditMode(false);
        showSuccess('Visitor information updated successfully');
      } else {
        showError(response.message || 'Failed to update visitor');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      showError(error.message || 'Failed to update visitor');
    } finally {
      setUpdating(false);
    }
  };

  const handleBack = () => {
    navigate('/service-delivery/employee');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FiLoader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading visitor details...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!visitor || !editingVisitor) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FiX className="w-8 h-8 text-red-600 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Visitor not found</p>
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Employee Dashboard
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Employee Dashboard"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#1a2744]">Visitor Details</h1>
          </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                Create Task
              </button>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <FiEdit3 className="w-4 h-4" />
                {isEditMode ? 'Cancel' : 'Edit'}
              </button>
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Belongs To Tasks Section */}
          {visitorTasks.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
              <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5 text-purple-600" />
                Related Tasks ({visitorTasks.length})
              </h3>
              <div className="space-y-3">
                {visitorTasks.map((task: any) => (
                  <div key={task._id} className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'In-progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {task.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            Priority: {task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {task.dueDate && `Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiUser className="w-5 h-5 text-blue-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                  <input
                    type="text"
                    value={editingVisitor.full_name || ''}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      isEditMode
                        ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                    }`}
                  />
              </div>

              {/* Telephone */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Telephone
                </label>
                  <input
                    type="text"
                    value={editingVisitor.telephone || ''}
                    onChange={(e) => handleInputChange('telephone', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      isEditMode
                        ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                    }`}
                  />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Email
                </label>
                  <input
                    type="email"
                    value={editingVisitor.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      isEditMode
                        ? emailError
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                    }`}
                  />
                  {isEditMode && emailError && (
                    <p className="mt-1 text-xs text-red-500">{emailError}</p>
                  )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Gender
                </label>
                    <select
                      value={editingVisitor.gender || 'Not Specified'}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={!isEditMode}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isEditMode
                          ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                          : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                      }`}
                    >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Not Specified">Not Specified</option>
                </select>
              </div>

              {/* Badge Number */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Badge Number
                </label>
                <input
                  type="text"
                  value={editingVisitor.badge_number || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm cursor-not-allowed"
                />
              </div>

              {/* ID Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  ID Type
                </label>
                <select
                  value={editingVisitor.identification?.id_type || ''}
                  onChange={(e) => handleInputChange('identification.id_type', e.target.value)}
                  disabled={!isEditMode}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    isEditMode
                      ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                  }`}
                >
                  <option value="">Select ID Type</option>
                  <option value="National ID">National ID</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving Licence">Driving Licence</option>
                </select>
              </div>

              {/* ID Number */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  {
                     editingVisitor.identification?.id_type === 'National ID' ? (
                      "National ID Number"
                    ) : editingVisitor.identification?.id_type === 'Passport' ? (
                      "Passport Number"
                    ) : editingVisitor.identification?.id_type === 'Driving Licence' ? (
                      "Driving Licence Number"
                    ) : (
                      "ID Number"
                    )
                  }
                </label>
                  <input
                    type="text"
                    value={editingVisitor.identification?.number || ''}
                    onChange={(e) => handleInputChange('identification.number', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      isEditMode
                        ? idError
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                    }`}
                  />
                  {isEditMode && idError && (
                    <p className="mt-1 text-xs text-red-500">{idError}</p>
                  )}
                  {isEditMode && editingVisitor.identification?.id_type === 'National ID' &&
                   editingVisitor.identification?.number &&
                   !idError && (
                    <p className="mt-1 text-xs text-green-600">✓ National ID format valid</p>
                  )}
              </div>
            </div>
          </div>

          {/* Vehicle Information Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiRefreshCw className="w-5 h-5 text-green-600" />
              Vehicle Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Has Vehicle */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  Has Vehicle
                </label>
                <select
                  value={editingVisitor.vehicle_storage?.has_vehicle ? 'true' : 'false'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm cursor-not-allowed"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              {/* License Plate */}
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  value={editingVisitor.vehicle_storage?.vehicle_details?.plate_number || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm cursor-not-allowed"
                  placeholder="e.g., RAB123A"
                />
              </div>
            </div>
          </div>

          {/* Department Assignments Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5 text-purple-600" />
              Department Assignments
            </h3>
            <div className="space-y-3">
              {editingVisitor.departments_assigned?.map((dept: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-purple-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Department</span>
                      <p className="text-sm font-medium text-gray-900">{dept.department_name}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Assigned Time</span>
                      <p className="text-sm text-gray-700">
                        {new Date(dept.assigned_time).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Provider</span>
                      <p className="text-sm text-gray-700">{dept.provider_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-2">Reached</span>
                      <div className="flex">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          dept.reached_in ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {dept.reached_in ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Status Section */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiClock className="w-5 h-5 text-orange-600" />
              Service Status
            </h3>
            <div className="space-y-3">
              {editingVisitor.services_status?.map((status: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Department</span>
                      <p className="text-sm font-medium text-gray-900">{status.department_name}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Provider</span>
                      <p className="text-sm text-gray-700">{status.provider_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-2">Status</span>
                      <div className="flex">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          status.s_type === 'Completed' ? 'bg-green-100 text-green-800' :
                          status.s_type === 'Inprogress' ? 'bg-blue-100 text-blue-800' :
                          status.s_type === 'Transfered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status.s_type || 'Not started'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Notes Section */}
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiUser className="w-5 h-5 text-gray-600" />
              Notes & Comments
            </h3>
            <div className="space-y-3">
              {editingVisitor.notes?.map((note: any, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900">{note.writter_name}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.message}</p>
                </div>
              ))}
              {(!editingVisitor.notes || editingVisitor.notes.length === 0) && (
                <p className="text-sm text-gray-500 italic">No notes available</p>
              )}
            </div>
          </div>

          {/* Status Information Section */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
            <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5 text-indigo-600" />
              Status Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-1">Entry Date</span>
                <p className="text-sm font-medium text-gray-900">
                  {editingVisitor.entry_date ? new Date(editingVisitor.entry_date).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-1">Exit Date</span>
                <p className="text-sm font-medium text-gray-900">
                  {editingVisitor.exist_date ? new Date(editingVisitor.exist_date).toLocaleString() : 'Still In-house'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-1">Is Being Served</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  editingVisitor.is_being_served ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {editingVisitor.is_being_served ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider block mb-1">Still In-house</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  editingVisitor.is_still_inhouse ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {editingVisitor.is_still_inhouse ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {isEditMode && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={handleUpdateVisitor}
              disabled={updating || !!idError || !!emailError}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {updating ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Saving updates...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Save updates
                </>
              )}
            </button>
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateTaskModal && (
          <CreateTaskModal
            onClose={() => setShowCreateTaskModal(false)}
            onSuccess={() => {
              setShowCreateTaskModal(false);
              showSuccess('Task created successfully');
            }}
            TaskStatus="Under-review"
            belongs={{
              isBelongsTo: true,
              itBelongsTo: visitorId
            }}
            belongsToName={visitor?.full_name}
            belongsToEmail={visitor?.email}
            belongstoTelephone={visitor?.telephone}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default VisitorDetailsPage;