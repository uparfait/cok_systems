import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { employeeService, departmentService, roleService } from '../../../core/services/adminService';
import { dispatchToast } from '../../../core/services/apiClient';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import ErrorModal from '../../../core/components/Modals/ErrorModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import Table from '../../../core/components/Table';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiRefreshCw, FiUsers, FiMail, FiPhone, FiAlertCircle, FiCheck } from 'react-icons/fi';
import EmployeeFormModal from './sub/EmployeeFormModal';

interface Employee { _id?: string; employee_id?: string; full_name?: string; telephone?: string; email: string; identification?: { id_type: string; number: string }; gender?: string; title?: string; department?: string | { _id?: string; department_id?: string; department_name?: string; department_unit?: string }; department_name?: string; department_id?: string; department_unit?: string; status?: string; roles?: { role_name: string; permissions: any[] }; createdAt?: string; }
interface Department { _id?: string; department_id?: string; department_name?: string; department_leader?: string; sub_department_mng?: { is_sub_department: boolean | string; parent_department_id: string }; }
interface RoleFromBackend { _id?: string; role_name: string; permissions?: Array<{ resource_name: string; actions: Array<{ action: string; description?: string; is_enabled?: boolean }> }>; }

const EmployeesPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleFromBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [departmentUnits, setDepartmentUnits] = useState<Department[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({ full_name: '', telephone: '', email: '', identification: { id_type: 'National ID', number: '' }, gender: '', title: '', department: '', department_name: '', department_id: '', department_unit: '', roles: { role_name: 'department_employee', permissions: [] } });

  useEffect(() => { if (showModal) { setFormError(''); setFormSuccess(''); if (roles.length === 0) loadRoles(); } }, [showModal, roles.length]);
  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); else if (isAuthenticated) { loadEmployees(1, pageLimit); loadDepartments(); loadRoles(); } }, [isAuthenticated, authLoading, navigate, pageLimit]);

  const loadEmployees = async (page = 1, limit = pageLimit) => {
    try { setLoading(true); setfirstLoad(true); setError(''); const r = await employeeService.getAll(page, limit);
      if (r.success) { const d = Array.isArray(r.data) ? r.data : (r.data?.data || []); setEmployees(d); setTotalEmployees(r.total || d.length); setTotalPages(Math.ceil((r.total || d.length) / limit)); setCurrentPage(page); }
      else setError(r.message || r.error || 'Failed to load employees');
    } catch (err: any) { setError(err.message || 'An error occurred'); } finally { setLoading(false); setfirstLoad(false); }
  };

  const loadDepartments = async () => {
    try { const r = await departmentService.getAll();
      if (r.success) { const d = Array.isArray(r.data) ? r.data : (r.data?.data || []); setAllDepartments(d); setDepartments(d.filter((x: any) => !x.sub_department_mng?.is_sub_department)); }
    } catch (err) { console.error(err); }
  };

  const loadDepartmentUnits = async (departmentId: string) => {
    if (!departmentId) { setDepartmentUnits([]); setLoadingUnits(false); return; }
    try { setLoadingUnits(true); const r = await departmentService.getAll();
      if (r.success) { const d = Array.isArray(r.data) ? r.data : (r.data?.data || []); setDepartmentUnits(d.filter((x: any) => (x.sub_department_mng?.is_sub_department === true || x.sub_department_mng?.is_sub_department === 'true') && String(x.sub_department_mng?.parent_department_id) === String(departmentId))); }
    } catch (err) { console.error(err); } finally { setLoadingUnits(false); }
  };

  const loadRoles = async () => {
    try { const r = await roleService.getAll(); if (r.success && r.data) { setRoles(Array.isArray(r.data) ? r.data : (r.data?.data || [])); } }
    catch (err) { console.error(err); }
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) { loadEmployees(1, pageLimit); return; }
    try { setLoading(true); const r = await employeeService.search(query);
      if (r.success) { const d = Array.isArray(r.data) ? r.data : (r.data?.data || []); setEmployees(d); setTotalEmployees(d.length); setTotalPages(1); setCurrentPage(1); }
    } catch (err: any) { setError(err.message || 'Search failed'); } finally { setLoading(false); }
  };

  const handleNewEmployee = () => { setEditingEmployee(null); setFormData({ full_name: '', telephone: '', email: '', identification: { id_type: 'National ID', number: '' }, gender: '', title: '', department: '', department_name: '', department_id: '', department_unit: '', roles: { role_name: 'department_employee', permissions: [] } }); setDepartmentUnits([]); setFormError(''); setFormSuccess(''); setShowModal(true); };

  const handleEdit = (employee: Employee) => {
    const hasDeptObj = employee.department && typeof employee.department === 'object';
    const deptName = hasDeptObj ? (employee.department as any)?.department_name : employee.department_name || '';
    const deptId = hasDeptObj ? (employee.department as any)?._id : employee.department_id || '';
    const unitVal = employee.department_unit || (hasDeptObj && (employee.department as any).department_unit) || '';
    setEditingEmployee(employee);
    setFormData({ full_name: employee.full_name || '', telephone: employee.telephone || '', email: employee.email || '', identification: employee.identification || { id_type: 'National ID', number: '' }, gender: employee.gender || '', title: employee.title || '', department: deptName, department_name: deptName, department_id: deptId, department_unit: unitVal, roles: { role_name: employee.roles?.role_name || 'department_employee', permissions: [] } });
    if (deptId) { setLoadingUnits(true); loadDepartmentUnits(deptId); }
    setFormError(''); setFormSuccess(''); setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setFormSuccess('');
    if (!formData.full_name?.trim() || !formData.email?.trim()) { setFormError('Please fill in all required fields'); return; }
    try { setSubmitting(true);
      if (editingEmployee?._id || editingEmployee?.employee_id) {
        const id = editingEmployee._id || editingEmployee.employee_id || '';
        const r = await employeeService.update(id, formData);
        if (r.success) { setFormSuccess(r.message || 'Employee updated!'); setTimeout(() => { setShowModal(false); loadEmployees(currentPage, pageLimit); }, 1500); }
        else setFormError(r.error || 'Failed to update');
      } else {
        const r = await employeeService.create(formData);
        if (r.success) { setFormSuccess(r.message || 'Employee created!'); setTimeout(() => { setShowModal(false); loadEmployees(currentPage, pageLimit); }, 1500); }
        else setFormError(r.error || 'Failed to create');
      }
    } catch (err: any) { setFormError(err.message || 'Failed to save'); } finally { setSubmitting(false); setShowModal(false)}
  };

  const handleDeleteClick = (id: string, name: string) => { setDeletingId(id); setDeletingName(name); setShowDeleteConfirm(true); };
  const handleConfirmDelete = async () => { if (!deletingId) return; try { setDeleting(true); await employeeService.delete(deletingId); setShowDeleteConfirm(false); loadEmployees(currentPage, pageLimit); } catch (err: any) { setError(err.message || 'Failed to delete'); } finally { setDeleting(false); setDeletingId(null); setDeletingName(''); } };
  const handleCancelDelete = () => { setShowDeleteConfirm(false); setDeletingId(null); setDeletingName(''); };

  const handleOpenMultipleUpload = () => { setUploadFile(null); setUploadError(''); setUploadSuccess(''); setUploadErrors([]); setShowMultipleUploadModal(true); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!['.xlsx', '.xls', '.csv'].includes(ext)) { setUploadError('Invalid file type'); setUploadFile(null); return; }
      if (file.size > 5 * 1024 * 1024) { setUploadError('File exceeds 5MB'); setUploadFile(null); return; }
      setUploadFile(file); setUploadError('');
    }
  };

  const handleDownloadTemplate = async () => {
    try { setDownloadingTemplate(true); setUploadError(''); const r = await employeeService.downloadTemplate();
      if (r.success && r.data) { const blob = r.data as Blob; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'employee_template.xlsx'; link.click(); URL.revokeObjectURL(url); }
      else throw new Error(r.error || 'Failed');
    } catch (error) { setUploadError('Failed to download template'); } finally { setDownloadingTemplate(false); }
  };

  const handleMultipleUpload = async () => {
    if (!uploadFile) { setUploadError('Please select a file'); return; }
    try { setUploading(true); setUploadError(''); setUploadSuccess(''); setUploadErrors([]);
      const fd = new FormData(); fd.append('file', uploadFile);
      const r = await employeeService.createMultiple(fd);
      if (r.success) { setUploadSuccess(r.message || 'Employees created!'); dispatchToast('success', r.message || 'Employees created!'); setTimeout(() => { setShowMultipleUploadModal(false); loadEmployees(currentPage, pageLimit); }, 2000); }
      else { setErrorModalTitle('Upload Failed'); setErrorModalMessage(r.message || 'Failed'); setErrorModalErrors(r.errors || []); setShowErrorModal(true); }
    } catch (err: any) { setErrorModalTitle('Upload Failed'); setErrorModalMessage(err.message || 'Failed'); setErrorModalErrors(err.errors || []); setShowErrorModal(true); }
    finally { setUploading(false); }
  };

  const getUnitNameDisplay = (employee: Employee) => {
    const rawUnitVal = employee.department_unit || (employee.department && typeof employee.department === 'object' && (employee.department as any).department_unit);
    if (!rawUnitVal || rawUnitVal === 'Not specified') return '-';
    if (typeof rawUnitVal === 'object' && (rawUnitVal as any).department_name) return (rawUnitVal as any).department_name;
    const searchId = String(rawUnitVal).trim();
    const matched = allDepartments.find(d => String(d._id) === searchId || String(d.department_id) === searchId);
    return matched?.department_name || searchId;
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiUsers className="w-6 h-6 text-blue-600" />Employees</h1><p className="text-xs text-gray-500 mt-0.5">Manage employees in the organization</p></div>
          <div className="flex gap-2">
            <button onClick={handleNewEmployee} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"><FiPlus className="w-4 h-4" />Add Employee</button>
            <button onClick={handleOpenMultipleUpload} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"><FiPlus className="w-4 h-4" />Add Multiple</button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search employees..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = setTimeout(() => handleSearch(e.target.value), 500); }} className="w-full pl-9 pr-3 py-1.5 border border-gray-300 text-sm" />
            </div>
            <button onClick={() => { setSearchQuery(''); if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); loadEmployees(1, pageLimit); }} className="p-1.5 hover:bg-gray-100 text-gray-600"><FiRefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 flex items-center gap-2 text-sm"><FiAlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        <Table headers={[{ key: 'employee', label: 'Employee' }, { key: 'contact', label: 'Contact' }, { key: 'department', label: 'Department' }, { key: 'unit', label: 'Unit' }, { key: 'position', label: 'Position' }, { key: 'actions', label: 'Actions' }]} data={employees} loading={loading && firstLoad} emptyMessage="No employees found" maxHeight="400px" minWidth="700px"
          renderCell={(header, employee: any) => {
            switch (header.key) {
              case 'employee': return <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-semibold text-xs">{(employee.full_name || 'E').charAt(0).toUpperCase()}</span></div><div><p className="text-sm font-medium text-gray-900">{employee.full_name || '-'}</p><p className="text-xs text-gray-500">{employee.email}</p></div></div>;
              case 'contact': return <div className="text-xs text-gray-600">{employee.telephone && <p className="flex items-center gap-1"><FiPhone className="w-3 h-3" />{employee.telephone}</p>}<p className="flex items-center gap-1"><FiMail className="w-3 h-3" />{employee.email}</p></div>;
              case 'department': return <span className="text-sm text-gray-900">{employee.department_name || (employee.department && typeof employee.department === 'object' && (employee.department as any)?.department_name) || '-'}</span>;
              case 'unit': return <span className="text-sm text-gray-900 font-medium">{getUnitNameDisplay(employee)}</span>;
              case 'position': return <span className="text-sm text-gray-900">{employee.roles?.role_name ? employee.roles.role_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '-'}</span>;
              case 'actions': return <div className="flex items-center justify-end gap-1"><button onClick={() => handleEdit(employee)} className="p-1.5 text-blue-600 hover:bg-blue-50"><FiEdit2 className="w-3.5 h-3.5" /></button><button onClick={() => handleDeleteClick(employee._id || employee.employee_id || '', employee.full_name || 'this employee')} className="p-1.5 text-red-600 hover:bg-red-50"><FiTrash2 className="w-3.5 h-3.5" /></button></div>;
              default: return <span>{employee[header.key] || '-'}</span>;
            }
          }}
          pagination={totalPages > 1 ? { currentPage, totalPages, totalCount: totalEmployees, itemsPerPage: pageLimit, onPageChange: (page) => { setCurrentPage(page); loadEmployees(page, pageLimit); }, loading } : undefined}
        />

        <EmployeeFormModal show={showModal} editing={!!editingEmployee} formData={formData as any} formError={formError} formSuccess={formSuccess} submitting={submitting} departments={departments} departmentUnits={departmentUnits} loadingUnits={loadingUnits} roles={roles} onClose={() => setShowModal(false)} onSubmit={handleSubmit} onChange={(data) => setFormData(data)} onDepartmentChange={(name, id) => { setFormData({ ...formData, department_name: name, department_id: id, department_unit: '' }); if (id) { setLoadingUnits(true); loadDepartmentUnits(id); } else setDepartmentUnits([]); }} />

        {showMultipleUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl m-3 sm:m-6">
              <div className="p-4 border-b bg-gray-50 sticky top-0 flex items-center justify-between z-10">
                <div className="flex items-center gap-3"><div className="w-9 h-9 bg-green-100 flex items-center justify-center"><FiPlus className="w-4 h-4 text-green-600" /></div><div><h2 className="text-sm font-bold text-gray-900">Add Multiple Employees</h2><p className="text-xs text-gray-500">Upload Excel or CSV file</p></div></div>
                <button onClick={() => setShowMultipleUploadModal(false)} className="p-1.5 hover:bg-gray-200">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleMultipleUpload(); }} className="p-4 space-y-4">
                {uploadSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 flex items-center gap-2 text-sm"><FiCheck className="w-4 h-4" />{uploadSuccess}</div>}
                <div className="bg-blue-50 p-3"><div className="flex items-center justify-between mb-2"><h4 className="text-xs font-semibold text-blue-900">File Format:</h4><button type="button" onClick={handleDownloadTemplate} disabled={downloadingTemplate} className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400">{downloadingTemplate ? 'Downloading...' : 'Download Template'}</button></div>
                  <ul className="text-xs text-blue-800 space-y-0.5"><li>• Required: telephone, email, gender</li><li>• Optional: department, department_unit, role</li><li>• Max 5MB, .xlsx/.xls/.csv</li></ul>
                </div>
                <div><label className="text-xs font-medium text-gray-700 mb-1 block">Upload File <span className="text-red-500">*</span></label>
                  <div className="border-2 border-dashed border-gray-300 p-4 text-center hover:border-green-400">
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer"><div className="flex flex-col items-center gap-1"><span className="text-xs text-gray-600">{uploadFile ? uploadFile.name : 'Click to select file'}</span><span className="text-xs text-gray-500">Excel (.xlsx, .xls) or CSV</span></div></label>
                  </div>
                  {uploadFile && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><FiCheck className="w-3 h-3" />{uploadFile.name}</p>}
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowMultipleUploadModal(false)} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={uploading || !uploadFile || !!uploadSuccess} className={`flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 ${uploading || !uploadFile ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? 'Uploading...' : uploadSuccess ? 'Uploaded!' : 'Upload Employees'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal isOpen={showDeleteConfirm} title="Delete Employee" message={`Are you sure you want to delete "${deletingName}"?`} confirmText="Delete" cancelText="Cancel" onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} type="danger" isLoading={deleting} />
        <ErrorModal isOpen={showErrorModal} title={errorModalTitle} message={errorModalMessage} errors={errorModalErrors} onClose={() => setShowErrorModal(false)} type="error" />
      </div>
    </MainLayout>
  );
};

export default EmployeesPage;