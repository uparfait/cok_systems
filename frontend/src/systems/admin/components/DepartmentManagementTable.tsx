import React, { useState, useMemo } from 'react'
import { departmentService, type Department, type Service, type Employee } from '../../../core/services/adminService'
import {
  FiPlus, FiEdit2, FiTrash2, FiUsers, FiRefreshCw, FiX, FiCheck,
  FiAlertCircle, FiChevronLeft, FiChevronRight, FiPackage, FiSearch
} from 'react-icons/fi'
import { HiOutlineOfficeBuilding } from 'react-icons/hi'

interface DepartmentTableProps {
  departments: Department[]
  employees: Employee[]
  loading: boolean
  onEdit: (dept: Department) => void
  onDelete: (id: string, name: string) => void
  onAddUnit: (dept: Department) => void
  onViewDetails: (dept: Department) => void
  refreshDepartments: () => void
}

const DepartmentManagementTable: React.FC<DepartmentTableProps> = ({
  departments,
  employees,
  loading,
  onEdit,
  onDelete,
  onAddUnit,
  onViewDetails,
  refreshDepartments
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showEmployeesModal, setShowEmployeesModal] = useState(false)
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [employeesPage, setEmployeesPage] = useState(1)
  const [employeesSearchQuery, setEmployeesSearchQuery] = useState('')
  const [servicesPage, setServicesPage] = useState(1)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDesc, setNewServiceDesc] = useState('')
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [editServiceName, setEditServiceName] = useState('')
  const [editServiceDesc, setEditServiceDesc] = useState('')
  const [serviceError, setServiceError] = useState('')
  const [serviceLoading, setServiceLoading] = useState(false)
  const [hoveredDeptId, setHoveredDeptId] = useState<string | null>(null)
  
  const itemsPerPage = 10

  // Flatten departments with sub-departments
  const flattenedDepartments = useMemo(() => {
    const flattened: (Department & { isSubDepartment?: boolean; parentId?: string; level?: number })[] = []
    
    departments.forEach(dept => {
      // Add parent department
      if (dept.sub_department_mng?.is_sub_department !== true && 
          dept.sub_department_mng?.is_sub_department !== 'true') {
        flattened.push({ ...dept, isSubDepartment: false, level: 0 })
        
        // Add sub-departments
        if (dept.sub_departments && dept.sub_departments.length > 0) {
          dept.sub_departments.forEach(subDept => {
            flattened.push({ 
              ...subDept, 
              isSubDepartment: true, 
              parentId: dept._id,
              level: 1
            })
          })
        }
      }
    })
    
    return flattened
  }, [departments])

  // Get employees for specific department with search filter
  const getDepartmentEmployees = (dept: Department) => {
    let filtered = employees.filter((emp: any) =>
      emp.department === dept.department_name ||
      emp.department?.department_name === dept.department_name ||
      emp.department?._id === dept._id
    )

    // Apply search filter
    if (employeesSearchQuery.trim()) {
      const query = employeesSearchQuery.toLowerCase()
      filtered = filtered.filter((emp: any) =>
        emp.full_name?.toLowerCase().includes(query) ||
        emp.email?.toLowerCase().includes(query) ||
        emp.telephone?.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  // Count sub-departments
  const getSubDepartmentCount = (dept: Department) => {
    if (!dept.sub_departments) return 0
    return dept.sub_departments.length
  }

  // Pagination helpers
  const paginateArray = (arr: any[], page: number, itemsPerPage: number) => {
    const startIdx = (page - 1) * itemsPerPage
    return arr.slice(startIdx, startIdx + itemsPerPage)
  }

  const getTotalPages = (total: number) => Math.ceil(total / itemsPerPage)

  const handleShowEmployees = (dept: Department) => {
    setSelectedDepartment(dept)
    setEmployeesPage(1)
    setEmployeesSearchQuery('')
    setShowEmployeesModal(true)
  }

  const handleShowServices = (dept: Department) => {
    setSelectedDepartment(dept)
    setServicesPage(1)
    setShowServicesModal(true)
  }

  // Service Management
  const handleAddService = async () => {
    if (!selectedDepartment || !newServiceName.trim()) {
      setServiceError('Service name is required')
      return
    }

    try {
      setServiceLoading(true)
      setServiceError('')
      
      const response = await departmentService.addService(
        selectedDepartment._id || selectedDepartment.department_id || '',
        {
          service_name: newServiceName.trim(),
          service_description: newServiceDesc.trim(),
          service_id: `SVC-${Date.now()}`
        }
      )

      if (response.success) {
        const updatedDept = departments.find(d => d._id === selectedDepartment._id)
        if (updatedDept) {
          setSelectedDepartment(response.data)
        }
        setNewServiceName('')
        setNewServiceDesc('')
        refreshDepartments()
      } else {
        setServiceError(response.message || 'Failed to add service')
      }
    } catch (err: any) {
      setServiceError(err.message || 'Failed to add service')
    } finally {
      setServiceLoading(false)
    }
  }

  const handleEditService = async () => {
    if (!selectedDepartment || !editingServiceId || !editServiceName.trim()) {
      setServiceError('Service name is required')
      return
    }

    try {
      setServiceLoading(true)
      setServiceError('')
      
      const response = await departmentService.updateService(
        selectedDepartment._id || selectedDepartment.department_id || '',
        editingServiceId,
        {
          service_name: editServiceName.trim(),
          service_description: editServiceDesc.trim()
        }
      )

      if (response.success) {
        setSelectedDepartment(response.data)
        setEditingServiceId(null)
        setEditServiceName('')
        setEditServiceDesc('')
        refreshDepartments()
      } else {
        setServiceError(response.message || 'Failed to update service')
      }
    } catch (err: any) {
      setServiceError(err.message || 'Failed to update service')
    } finally {
      setServiceLoading(false)
    }
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedDepartment) return

    try {
      setServiceLoading(true)
      setServiceError('')
      
      const response = await departmentService.deleteService(
        selectedDepartment._id || selectedDepartment.department_id || '',
        serviceId
      )

      if (response.success) {
        setSelectedDepartment(response.data)
        refreshDepartments()
      } else {
        setServiceError(response.message || 'Failed to delete service')
      }
    } catch (err: any) {
      setServiceError(err.message || 'Failed to delete service')
    } finally {
      setServiceLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Responsive Scrollable Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Department Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Department ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Room Number</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Department Leader</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total Employees</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total Services</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total Units</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Is Unit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading departments...</span>
                    </div>
                  </td>
                </tr>
              ) : flattenedDepartments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <HiOutlineOfficeBuilding className="w-10 h-10 text-gray-300" />
                      <p className="text-gray-500">No departments found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                flattenedDepartments.map((dept) => {
                  const deptEmployees = getDepartmentEmployees(dept)
                  const deptServices = dept.services || []
                  const subDeptCount = getSubDepartmentCount(dept)
                  const isSubDept = dept.isSubDepartment
                  const deptKey = `${dept._id}-${isSubDept ? 'sub' : 'parent'}`

                  return (
                    <tr
                      key={deptKey}
                      className={`hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${
                        isSubDept ? 'bg-purple-50/30' : ''
                      }`}
                      onMouseEnter={() => setHoveredDeptId(deptKey)}
                      onMouseLeave={() => setHoveredDeptId(null)}
                    >
                      {/* Department Name - Small, non-bold, trimmed with tooltip */}
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-3 ${isSubDept ? 'ml-8' : ''}`}>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSubDept 
                              ? 'bg-purple-100' 
                              : 'bg-blue-100'
                          }`}>
                            <HiOutlineOfficeBuilding className={`w-5 h-5 ${
                              isSubDept 
                                ? 'text-purple-600' 
                                : 'text-blue-600'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <p 
                              className={`text-sm font-normal truncate max-w-xs ${
                                isSubDept ? 'text-purple-900' : 'text-gray-900'
                              }`}
                              title={dept.department_name}
                            >
                              {dept.department_name}
                            </p>
                            {dept.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">{dept.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium ${
                          isSubDept 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {dept.department_id}
                        </span>
                      </td>

                      {/* Room Number */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-600 font-medium">
                          {dept.room_number ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm">
                              🚪 {dept.room_number}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </span>
                      </td>

                      {/* Department Leader */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {typeof dept.department_leader === 'object' && dept.department_leader
                              ? dept.department_leader.full_name || dept.department_leader.email
                              : dept.department_leader || 'Not assigned'}
                          </p>
                          {typeof dept.department_leader === 'object' && dept.department_leader?.email && (
                            <p className="text-xs text-gray-500 truncate">{dept.department_leader.email}</p>
                          )}
                        </div>
                      </td>

                      {/* Total Employees (Clickable) */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleShowEmployees(dept)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-colors"
                        >
                          <FiUsers className="w-4 h-4" />
                          {deptEmployees.length}
                        </button>
                      </td>

                      {/* Total Services (Clickable) */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleShowServices(dept)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-colors"
                        >
                          <FiPackage className="w-4 h-4" />
                          {deptServices.length}
                        </button>
                      </td>

                      {/* Total Units (only for parent departments) */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {!isSubDept ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            subDeptCount > 0
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {subDeptCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Is Unit */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">
                          {isSubDept ? 'Yes' : 'No'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {!isSubDept && (
                            <button
                              onClick={() => onAddUnit(dept)}
                              className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                              title="Add Unit"
                            >
                              <FiPlus className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(dept)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(dept._id || dept.department_id || '', dept.department_name || 'this department')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employees Modal with Search & Pagination */}
      {showEmployeesModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Employees</h2>
                  <p className="text-sm text-gray-500">{selectedDepartment.department_name}</p>
                </div>
              </div>
              <button onClick={() => {
                setShowEmployeesModal(false)
                setEmployeesSearchQuery('')
              }} className="p-2 hover:bg-gray-200 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b bg-white flex-shrink-0">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={employeesSearchQuery}
                  onChange={(e) => {
                    setEmployeesSearchQuery(e.target.value)
                    setEmployeesPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {getDepartmentEmployees(selectedDepartment).length === 0 ? (
                <div className="text-center py-12">
                  <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{employeesSearchQuery ? 'No employees match your search' : 'No employees found'}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Employee</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Position</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paginateArray(getDepartmentEmployees(selectedDepartment), employeesPage, itemsPerPage).map((emp: any) => (
                          <tr key={emp._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-blue-600 font-semibold text-xs">{(emp.full_name || 'E').charAt(0)}</span>
                                </div>
                                <span className="font-medium text-gray-900">{emp.full_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                            <td className="px-4 py-3 text-gray-600">{emp.roles?.role_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-600">{emp.telephone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {getTotalPages(getDepartmentEmployees(selectedDepartment).length) > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEmployeesPage(Math.max(1, employeesPage - 1))}
                        disabled={employeesPage === 1}
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <FiChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {employeesPage} of {getTotalPages(getDepartmentEmployees(selectedDepartment).length)}
                      </span>
                      <button
                        onClick={() => setEmployeesPage(employeesPage + 1)}
                        disabled={employeesPage >= getTotalPages(getDepartmentEmployees(selectedDepartment).length)}
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <FiChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Services Modal - Enhanced UI/UX */}
      {showServicesModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b bg-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FiPackage className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Services Management</h2>
                  <p className="text-sm text-gray-500">{selectedDepartment.department_name}</p>
                </div>
              </div>
              <button onClick={() => {
                setShowServicesModal(false)
                setEditingServiceId(null)
                setNewServiceName('')
                setNewServiceDesc('')
              }} className="p-2 hover:bg-gray-200 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Error Message */}
              {serviceError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{serviceError}</span>
                </div>
              )}

              {/* Add/Edit Service Form */}
              <div className="rounded-xl p-5 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingServiceId ? 'Edit Service' : 'Add New Service'}
                </h3>
                
                <div className="space-y-4">
                  {/* Service Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingServiceId ? editServiceName : newServiceName}
                      onChange={(e) => editingServiceId 
                        ? setEditServiceName(e.target.value)
                        : setNewServiceName(e.target.value)
                      }
                      placeholder="e.g., Consultation"
                      className="w-full px-4 py-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Description - Expandable Textarea */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingServiceId ? editServiceDesc : newServiceDesc}
                      onChange={(e) => editingServiceId 
                        ? setEditServiceDesc(e.target.value)
                        : setNewServiceDesc(e.target.value)
                      }
                      placeholder="Brief description of the service (optional)"
                      rows={3}
                      className="w-full px-4 py-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {editingServiceId ? (
                      <>
                        <button
                          onClick={handleEditService}
                          disabled={serviceLoading || !editServiceName.trim()}
                          className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {serviceLoading ? (
                            <>
                              <FiRefreshCw className="w-4 h-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <FiCheck className="w-4 h-4" />
                              Update Service
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingServiceId(null)
                            setEditServiceName('')
                            setEditServiceDesc('')
                          }}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleAddService}
                        disabled={serviceLoading || !newServiceName.trim()}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {serviceLoading ? (
                          <>
                            <FiRefreshCw className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <FiPlus className="w-4 h-4" />
                            Add Service
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Services List - Enhanced UI/UX */}
              {!selectedDepartment.services || selectedDepartment.services.length === 0 ? (
                <div className="text-center py-12">
                  <FiPackage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No services yet. Add one to get started!</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Services ({selectedDepartment.services.length})</h3>
                    
                    <div className="space-y-3">
                      {paginateArray(selectedDepartment.services, servicesPage, itemsPerPage).map((service: any) => (
                        <div
                          key={service._id}
                          className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          {/* Service Header */}
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 text-base">{service.service_name}</h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingServiceId(service._id)
                                  setEditServiceName(service.service_name)
                                  setEditServiceDesc(service.service_description || '')
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Service"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteService(service._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Service"
                                disabled={serviceLoading}
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Service Description with Word Wrap */}
                          {service.service_description && (
                            <p className="text-sm text-gray-600 break-words whitespace-pre-wrap">{service.service_description}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {getTotalPages(selectedDepartment.services.length) > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          onClick={() => setServicesPage(Math.max(1, servicesPage - 1))}
                          disabled={servicesPage === 1}
                          className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <FiChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {servicesPage} of {getTotalPages(selectedDepartment.services.length)}
                        </span>
                        <button
                          onClick={() => setServicesPage(servicesPage + 1)}
                          disabled={servicesPage >= getTotalPages(selectedDepartment.services.length)}
                          className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <FiChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DepartmentManagementTable
