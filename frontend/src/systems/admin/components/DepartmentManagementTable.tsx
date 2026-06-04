import React, { useState, useMemo, useCallback } from 'react'
import { type Department, departmentService, normalizeDepartment } from '../../../core/services/adminService'
import {
  FiPlus, FiEdit2, FiTrash2, FiUsers, FiRefreshCw, FiX, FiCheck,
  FiAlertCircle, FiChevronLeft, FiChevronRight, FiPackage, FiSearch,
  FiSave
} from 'react-icons/fi'
import { HiOutlineOfficeBuilding } from 'react-icons/hi'

interface DepartmentTableProps {
  departments: Department[]
  employees: any[]
  loading?: boolean
  onEdit: (dept: Department) => void
  onDelete: (id: string, name: string) => void
  onAddUnit?: (dept: Department) => void
  onViewDetails?: (dept: Department) => void
  refreshDepartments: () => void
}

/* ── Tree Builder: flat API list → nested tree ── */
function buildTree(flat: Department[]): (Department & { depth: number; children: Department[] })[] {
  const map = new Map<string, Department & { depth: number; children: Department[] }>()
  const roots: (Department & { depth: number; children: Department[] })[] = []

  // Create nodes
  for (const d of flat) {
    map.set(d._id, { ...d, depth: 0, children: [] })
  }

  // Link children to parents
  for (const d of flat) {
    const node = map.get(d._id)!
    // Check for sub-department via parent_department or sub_department_mng
    let parentId: string | null = null
    if (typeof d.parent_department === 'object' && d.parent_department) {
      parentId = (d.parent_department as { _id?: string })._id || null
    }
    // Also check sub_department_mng (from the raw API response)
    const subMng = (d as any).sub_department_mng
    if (subMng?.is_sub_department && subMng?.parent_department_id) {
      parentId = subMng.parent_department_id
    }

    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else if (!parentId) {
      roots.push(node)
    }
  }

  // Recursively flatten with depth
  const flattened: (Department & { depth: number; isSubDept: boolean })[] = []
  function walk(nodes: (Department & { depth: number; children: Department[] })[], isSub = false) {
    for (const node of nodes) {
      flattened.push({ ...node, isSubDept: node.depth > 0 || isSub || node.is_unit })
      if (node.children.length > 0) walk(node.children, true)
    }
  }
  walk(roots)
  return flattened
}

/* ── Search employees by department ID via API ── */
async function fetchEmployeesByDept(deptId: string): Promise<any[]> {
  try {
    const { employeeService } = await import('../../../core/services/adminService')
    const res = await employeeService.getByDepartment(deptId, true, 1, 200)
    if (res?.success) {
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.employees || [])
      return Array.isArray(data) ? data : []
    }
  } catch { /* ignore */ }
  return []
}

const DepartmentManagementTable: React.FC<DepartmentTableProps> = ({
  departments,
  employees: _allEmployees,
  loading = false,
  onEdit,
  onDelete,
  refreshDepartments
}) => {
  const [showEmployeesModal, setShowEmployeesModal] = useState(false)
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [modalEmployees, setModalEmployees] = useState<any[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [empPage, setEmpPage] = useState(1)
  const [svcPage, setSvcPage] = useState(1)
  const PP = 10

  // Service form state
  const [svcName, setSvcName] = useState('')
  const [svcDesc, setSvcDesc] = useState('')
  const [editSvcId, setEditSvcId] = useState<string | null>(null)
  const [editSvcName, setEditSvcName] = useState('')
  const [editSvcDesc, setEditSvcDesc] = useState('')
  const [svcError, setSvcError] = useState('')
  const [svcLoading, setSvcLoading] = useState(false)

  const tree = useMemo(() => buildTree(departments), [departments])

  // ── Open employees modal ──
  const openEmployees = useCallback(async (dept: Department) => {
    setSelectedDept(dept)
    setEmpLoading(true)
    setShowEmployeesModal(true)
    setEmpPage(1)
    setEmpSearch('')
    const emps = await fetchEmployeesByDept(dept._id)
    setModalEmployees(emps)
    setEmpLoading(false)
  }, [])

  const filteredModalEmps = useMemo(() => {
    if (!empSearch) return modalEmployees
    const q = empSearch.toLowerCase()
    return modalEmployees.filter((e: any) =>
      e.full_name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    )
  }, [modalEmployees, empSearch])

  // ── Service operations ──
  const handleAddService = async () => {
    if (!selectedDept || !svcName.trim()) { setSvcError('Service name required'); return }
    setSvcLoading(true); setSvcError('')
    try {
      const res = await departmentService.addService(selectedDept._id, { name: svcName.trim(), description: svcDesc.trim() })
      if (res.success) { setSvcName(''); setSvcDesc(''); refreshDepartments() }
      else setSvcError(res.message || 'Failed')
    } catch (err: any) { setSvcError(err.message || 'Failed') }
    finally { setSvcLoading(false) }
  }

  const handleEditService = async () => {
    if (!selectedDept || !editSvcId || !editSvcName.trim()) { setSvcError('Service name required'); return }
    setSvcLoading(true); setSvcError('')
    try {
      const res = await departmentService.updateService(selectedDept._id, editSvcId, { name: editSvcName.trim(), description: editSvcDesc.trim() })
      if (res.success) { setEditSvcId(null); setEditSvcName(''); setEditSvcDesc(''); refreshDepartments(); setSvcPage(1) }
      else setSvcError(res.message || 'Failed')
    } catch (err: any) { setSvcError(err.message || 'Failed') }
    finally { setSvcLoading(false) }
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!selectedDept) return
    if (!confirm('Are you sure you want to delete this service?')) return
    setSvcLoading(true); setSvcError('')
    try {
      const res = await departmentService.deleteService(selectedDept._id, serviceId)
      if (res.success) { 
        refreshDepartments()
        setSvcPage(1)
      }
      else setSvcError(res.message || 'Failed to delete service')
    } catch (err: any) { setSvcError(err.message || 'Failed to delete service') }
    finally { setSvcLoading(false) }
  }

  const startEditSvc = (svc: any) => {
    setEditSvcId(svc._id || svc.service_id)
    setEditSvcName(svc.name || svc.service_name || '')
    setEditSvcDesc(svc.description || svc.service_description || '')
  }

  const getLeaderName = (d: Department): string => {
    const leader = d.leader || d.department_leader
    if (!leader) return 'Not assigned'
    if (typeof leader === 'string') return leader
    if (typeof leader === 'object') return leader.full_name || leader.email || 'N/A'
    return 'Not assigned'
  }

  function paginate<T>(arr: T[], page: number): T[] {
    return arr.slice((page - 1) * PP, page * PP)
  }

  return (
    <div className="space-y-4">
      {/* ─── TABLE ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Department Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Room Number</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Department Leader</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Total Employees</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Services</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center">
                  <div className="flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="text-gray-500">Loading departments...</span>
                  </div>
                </td></tr>
              ) : tree.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <HiOutlineOfficeBuilding className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No departments found</p>
                </td></tr>
              ) : tree.map((dept, idx) => {
                const key = dept._id || `d-${idx}`
                const depth = dept.depth || 0
                const isSub = dept.isSubDept || depth > 0
                const leaderName = getLeaderName(dept)
                const services = dept.services || []

                return (
                  <tr key={key}
                    className={`hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${isSub ? 'bg-purple-50/30' : ''}`}>
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3" style={{ marginLeft: depth > 0 ? `${depth * 32}px` : '0' }}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSub ? 'bg-purple-100' : 'bg-blue-100'}`}>
                          <HiOutlineOfficeBuilding className={`w-5 h-5 ${isSub ? 'text-purple-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate max-w-xs ${isSub ? 'text-purple-900' : 'text-gray-900'}`}>
                            {depth > 0 && '└─ '}{dept.name}
                          </p>
                          {isSub && <p className="text-[10px] text-purple-500 mt-0.5">Sub-department</p>}
                        </div>
                      </div>
                    </td>
                    {/* Room */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {dept.room_number ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm">🚪 {dept.room_number}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    {/* Leader */}
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium truncate ${leaderName === 'Not assigned' ? 'text-gray-400' : 'text-gray-900'}`}>{leaderName}</span>
                    </td>
                    {/* Employees */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button onClick={() => openEmployees(dept)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-colors">
                        <FiUsers className="w-4 h-4" />
                        {dept.total_employees || 0}
                      </button>
                    </td>
                    {/* Services */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button onClick={() => { setSelectedDept(dept); setSvcPage(1); setEditSvcId(null); setSvcName(''); setSvcDesc(''); setSvcError(''); setShowServicesModal(true) }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-colors">
                        <FiPackage className="w-4 h-4" />
                        {services.length}
                      </button>
                    </td>
                    {/* Description */}
                    <td className="px-6 py-4"><p className="text-sm text-gray-600 truncate max-w-xs">{dept.description || '—'}</p></td>
                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEdit(dept)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                        <button onClick={() => onDelete(dept._id, dept.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── EMPLOYEES MODAL ─── */}
      {showEmployeesModal && selectedDept && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEmployeesModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><FiUsers className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Employees — {selectedDept.name}</h2>
                  <p className="text-sm text-gray-500">{modalEmployees.length} employee{modalEmployees.length !== 1 ? 's' : ''} in this department</p>
                </div>
              </div>
              <button onClick={() => setShowEmployeesModal(false)} className="p-2 hover:bg-gray-200 rounded-lg"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-b bg-white flex-shrink-0">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search employees..." value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setEmpPage(1) }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {empLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              ) : filteredModalEmps.length === 0 ? (
                <div className="text-center py-12"><FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">{empSearch ? 'No matching employees' : 'No employees assigned'}</p></div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Employee</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginate(filteredModalEmps, empPage).map((emp: any) => (
                        <tr key={emp._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-xs">{(emp.full_name || '?').charAt(0)}</span>
                              </div>
                              <span className="font-medium text-gray-900">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{emp.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{emp.telephone || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{emp.roles?.role_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredModalEmps.length > PP && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={() => setEmpPage(p => Math.max(1, p - 1))} disabled={empPage === 1} className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"><FiChevronLeft className="w-4 h-4" /></button>
                      <span className="text-sm text-gray-600">Page {empPage} of {Math.ceil(filteredModalEmps.length / PP)}</span>
                      <button onClick={() => setEmpPage(p => p + 1)} disabled={empPage >= Math.ceil(filteredModalEmps.length / PP)} className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"><FiChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SERVICES MODAL ─── */}
      {showServicesModal && selectedDept && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowServicesModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><FiPackage className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Services — {selectedDept.name}</h2>
                  <p className="text-sm text-gray-500">Manage services offered by this department</p>
                </div>
              </div>
              <button onClick={() => setShowServicesModal(false)} className="p-2 hover:bg-gray-200 rounded-lg"><FiX className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {svcError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{svcError}</span>
                </div>
              )}

              {/* Add/Edit Form */}
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-5 border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  {editSvcId ? <FiEdit2 className="w-5 h-5 text-blue-600" /> : <FiPlus className="w-5 h-5 text-blue-600" />}
                  {editSvcId ? 'Edit Service' : 'Add Service'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Name <span className="text-red-500">*</span></label>
                    <input type="text" value={editSvcId ? editSvcName : svcName}
                      onChange={e => editSvcId ? setEditSvcName(e.target.value) : setSvcName(e.target.value)}
                      placeholder="e.g., Consultation, Permits..." className="w-full px-4 py-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                    <input type="text" value={editSvcId ? editSvcDesc : svcDesc}
                      onChange={e => editSvcId ? setEditSvcDesc(e.target.value) : setSvcDesc(e.target.value)}
                      placeholder="Brief description" className="w-full px-4 py-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {editSvcId ? (
                    <>
                      <button onClick={handleEditService} disabled={svcLoading || !editSvcName.trim()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
                        {svcLoading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
                        Update Service
                      </button>
                      <button onClick={() => { setEditSvcId(null); setEditSvcName(''); setEditSvcDesc('') }}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                    </>
                  ) : (
                    <button onClick={handleAddService} disabled={svcLoading || !svcName.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
                      {svcLoading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                      Add Service
                    </button>
                  )}
                </div>
              </div>

              {/* Services List */}
              {(!selectedDept.services || selectedDept.services.length === 0) ? (
                <div className="text-center py-12">
                  <FiPackage className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No services yet</p>
                  <p className="text-sm text-gray-400 mt-1">Add the first service using the form above.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">All Services ({selectedDept.services.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {paginate(selectedDept.services, svcPage).map((svc: any) => (
                      <div key={svc._id || svc.service_id}
                        className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-start justify-between group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            <h4 className="font-semibold text-gray-900">{svc.name || svc.service_name || 'Unnamed Service'}</h4>
                          </div>
                          {(svc.description || svc.service_description) && (
                            <p className="text-sm text-gray-600 mt-1 ml-4">{svc.description || svc.service_description}</p>
                          )}
                          {svc.created_at && (
                            <p className="text-[10px] text-gray-400 mt-1 ml-4">Created: {new Date(svc.created_at).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditSvc(svc)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteService(svc._id || svc.service_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" disabled={svcLoading}><FiTrash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedDept.services.length > PP && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button onClick={() => setSvcPage(p => Math.max(1, p - 1))} disabled={svcPage === 1} className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"><FiChevronLeft className="w-4 h-4" /></button>
                      <span className="text-sm text-gray-600">Page {svcPage} of {Math.ceil(selectedDept.services.length / PP)}</span>
                      <button onClick={() => setSvcPage(p => p + 1)} disabled={svcPage >= Math.ceil(selectedDept.services.length / PP)} className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded-lg"><FiChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DepartmentManagementTable