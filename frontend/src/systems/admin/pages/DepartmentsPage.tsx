import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { departmentService, employeeService, normalizeDepartments, type Department, type Employee } from '../../../core/services/adminService';
import DepartmentManagementTable from '../components/DepartmentManagementTable';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiPlus, FiSearch, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import {  FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formData, setFormData] = useState<Partial<Department>>({ name: '', description: '', room_number: '', department_id: '', leader: null, services: [] });

  useEffect(() => { if (showModal) { setFormError(''); setFormSuccess(''); } }, [showModal]);

  const loadDepartments = useCallback(async (isInitial = false) => {
    try { if (isInitial) setFirstLoad(true); setLoading(true); setError('');
      const [deptR, empR] = await Promise.all([departmentService.getAll(), employeeService.getAll()]);
      if (deptR?.success) setDepartments(normalizeDepartments(Array.isArray(deptR.data) ? deptR.data : (deptR.data?.data || [])));
      else if (deptR) setError(deptR.message || deptR.error || 'Failed');
      if (empR?.success) setEmployees(Array.isArray(empR.data) ? empR.data : (empR.data?.data || []));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error loading data'); }
    finally { setLoading(false); setFirstLoad(false); }
  }, []);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); else if (isAuthenticated) loadDepartments(true); }, [isAuthenticated, authLoading, navigate, location.pathname, loadDepartments]);

  const filteredDepartments = useMemo(() => {
    let f = departments.filter(d => !d.is_unit);
    if (searchQuery?.trim()) { const q = searchQuery.toLowerCase(); f = f.filter(d => d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.room_number?.toLowerCase().includes(q)); }
    return f;
  }, [departments, searchQuery]);

  const stats = useMemo(() => departments.filter(d => !d.is_unit).length, [departments]);

  const handleSearch = async () => {
    if (!searchQuery?.trim()) { loadDepartments(false); return; }
    try { setLoading(true); const r = await departmentService?.search(searchQuery); if (r.success) setDepartments(r.data || []); else setError(r.message || 'Search failed'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Search failed'); } finally { setLoading(false); }
  };

  const handleNewDepartment = () => { setEditingDepartment(null); setFormData({ name: '', description: '', room_number: '', department_id: '', leader: '', services: [] }); setFormError(''); setFormSuccess(''); setShowModal(true); };
  const handleEdit = (department: Department) => {
    let leaderId = ''; const leader = department.leader || department.department_leader;
    if (leader) { if (typeof leader === 'string') leaderId = leader; else if (typeof leader === 'object') leaderId = (leader as { _id?: string })._id || ''; }
    setEditingDepartment(department); setFormData({ name: department.name || '', description: department.description || '', room_number: department.room_number || '', department_id: department.department_id || '', leader: leaderId, services: department.services || [] }); setFormError(''); setFormSuccess(''); setShowModal(true);
  };
  const handleAddUnit = (department: Department) => { setEditingDepartment(null); setFormData({ name: '', description: '', room_number: '', department_id: '', leader: '', services: [], is_unit: true, parent_department: department._id }); setFormError(''); setFormSuccess(''); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setFormSuccess('');
    if (!formData?.name?.trim()) { setFormError('Department name is required'); return; }
    try { setSubmitting(true); const sd: Record<string, unknown> = { name: formData.name, description: formData.description || '', room_number: formData.room_number || '', department_id: formData.department_id || '', leader: formData.leader || null, services: formData.services || [] };
      if (formData?.is_unit) { sd.is_unit = true; if (formData?.parent_department) sd.parent_department = formData.parent_department; }
      if (editingDepartment?._id) { const r = await departmentService.update(editingDepartment._id, sd); if (r.success) { setFormSuccess(r.message || 'Updated!'); setTimeout(() => { setShowModal(false); loadDepartments(false); }, 1500); } else setFormError(r.message || 'Failed'); }
      else { const r = await departmentService.create(sd); if (r.success) { setFormSuccess(r.message || 'Created!'); setTimeout(() => { setShowModal(false); loadDepartments(false); }, 1500); } else setFormError(r.message || 'Failed'); }
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDeleteClick = (id: string, name: string) => { setDeletingId(id); setDeletingName(name); setShowDeleteConfirm(true); };
  const handleConfirmDelete = async () => { if (!deletingId) return; try { setDeleting(true); await departmentService.delete(deletingId); setShowDeleteConfirm(false); loadDepartments(false); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setDeleting(false); setDeletingId(null); setDeletingName(''); } };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
                        <div className="mt-3 inline-flex items-center gap-3 bg-gray-50 p-3 border border-gray-100">
            <div className="w-8 h-8 bg-blue-100 flex items-center rounded-full justify-center"><HiOutlineOfficeBuilding className="w-4 h-4 cok-primary-color" /></div>
            <div><p className="text-xs text-gray-500">Total Departments</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <p className="text-xl font-bold text-gray-900">{stats}</p>}</div>
          </div> </div>
            <button onClick={handleNewDepartment} className="inline-flex items-center gap-1.5 px-4 py-2 cok-btn-primary text-white max-w-max text-sm font-semibold"><FiPlus className="w-4 h-4" />Add Department</button>
          </div>

        </div>

        <div className="bg-white border border-gray-200 p-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search departments..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full pl-9 pr-3 py-1.5 cok-auth-input text-sm" /></div>
            <div className="flex items-center gap-2"><button onClick={handleSearch} className="px-3 py-1.5 cok-btn-primary text-white text-sm font-medium">Search</button><button onClick={() => loadDepartments(false)} className="p-1.5 hover:bg-gray-100 text-gray-600"><FiRefreshCw className="w-4 h-4" /></button></div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm flex items-center gap-2"><FiAlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        <div className="bg-white border border-gray-200 overflow-hidden">
          {loading && firstLoad ? <div className="p-8 text-center flex justify-center flex-row items-center text-gray-500"> <SpiralLoader /> </div>
            : filteredDepartments.length === 0 ? <div className="p-8 text-center rounded-full"><HiOutlineOfficeBuilding className="w-10 h-10 text-gray-400 mx-auto mb-3" /><h3 className="text-sm font-semibold text-gray-900 mb-1">No departments found</h3><p className="text-xs text-gray-500">{searchQuery ? 'Try adjusting your search' : 'Get started by adding your first department'}</p></div>
              : <DepartmentManagementTable departments={filteredDepartments} employees={employees} loading={loading} onEdit={handleEdit} onDelete={handleDeleteClick} onAddUnit={handleAddUnit} onViewDetails={handleEdit} refreshDepartments={() => loadDepartments(false)} />}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-4 border-b bg-gray-50"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-100 flex items-center rounded-full justify-center"><HiOutlineOfficeBuilding className="w-4 h-4 cok-primary-color" /></div><div><h2 className="text-sm font-bold text-gray-900">{editingDepartment ? 'Edit Department' : 'Add Department'}</h2><p className="text-xs text-gray-500">{editingDepartment ? 'Update details' : 'Create a new department'}</p></div></div></div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm flex items-start gap-2"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span></div>}
                {formSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 text-sm flex items-start gap-2"><FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formSuccess}</span></div>}
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Name <span className="text-red-500">*</span></label><input type="text" required value={formData?.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="Department name" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Department ID</label><input type="text" value={formData?.department_id || ''} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., DEP-001" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Room Number</label><input type="text" value={formData?.room_number || ''} onChange={e => setFormData({ ...formData, room_number: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., 101" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label><textarea value={formData?.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm resize-none" rows={2} placeholder="Description" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Department Leader</label><select value={typeof formData?.leader === 'string' ? formData?.leader : ''} onChange={e => setFormData({ ...formData, leader: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm"><option value="">No leader</option>{employees.map(emp => <option key={emp._id || emp.employee_id} value={emp._id || emp.employee_id || ''}>{emp.full_name} ({emp.email})</option>)}</select></div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={submitting} className="flex-1 px-3 py-2 cok-btn-primary text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : editingDepartment ? 'Update' : 'Create'}</button>
                                    
                                    <button type="button" onClick={() => setShowModal(false)} disabled={submitting} className="flex-1 px-3 py-2 cok-btn-outlined text-sm font-medium ">Cancel</button>
                  </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal isOpen={showDeleteConfirm} title="Delete Department" message={`Delete "${deletingName}"? This cannot be undone.`} confirmText="Delete" cancelText="Cancel" onConfirm={handleConfirmDelete} onCancel={() => setShowDeleteConfirm(false)} type="danger" isLoading={deleting} />
      </div>
    </MainLayout>
  );
};

export default DepartmentsPage;