import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { departmentService, normalizeDepartment, type Department, type DepartmentRaw } from '../../../core/services/adminService';
import DepartmentManagementTable, { type DepartmentRow } from '../components/DepartmentManagementTable';
import LeaderSearchInput, { type LeaderOption } from '../components/LeaderSearchInput';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import OverlayShell from '../../../core/components/overlay/OverlayShell';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiPlus, FiSearch, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import {  FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; error?: unknown };
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
    if (typeof e.error === 'string' && e.error.trim()) return e.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const toRow = (raw: DepartmentRaw): DepartmentRow => ({
  ...normalizeDepartment(raw),
  employee_count: Number((raw as { employee_count?: number }).employee_count) || 0,
  sub_departments: (raw.sub_departments || []).map(toRow),
});

const leaderOption = (leader: Department['leader'] | undefined): LeaderOption | null => {
  if (!leader) return null;
  return typeof leader === 'string' ? { _id: leader } : leader;
};

const matchesQuery = (d: DepartmentRow, q: string) => [d.name, d.description, d.room_number, d.dpt_id].some(v => (v || '').toLowerCase().includes(q));

const DepartmentsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [totals, setTotals] = useState({ departments: 0, units: 0 });
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
  const [formData, setFormData] = useState<Partial<Department>>({ name: '', description: '', room_number: '', dpt_id: '', leader: null, services: [] });

  useEffect(() => { if (showModal) { setFormError(''); setFormSuccess(''); } }, [showModal]);

  const loadDepartments = useCallback(async (isInitial = false) => {
    try { if (isInitial) setFirstLoad(true); setLoading(true); setError('');
      const r = await departmentService.getAll();
      if (r?.success) {
        const raw: DepartmentRaw[] = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setDepartments(raw.map(toRow));
        setTotals({ departments: Number(r.totals?.departments) || 0, units: Number(r.totals?.units) || 0 });
      } else if (r) setError(r.message || r.error || 'Failed');
    } catch (err) { setError(err instanceof Error ? err.message : 'Error loading data'); }
    finally { setLoading(false); setFirstLoad(false); }
  }, []);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); else if (isAuthenticated) loadDepartments(true); }, [isAuthenticated, authLoading, navigate, location.pathname, loadDepartments]);

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const main = departments.filter(d => !d.is_unit);
    if (!q) return main;
    return main.filter(d => matchesQuery(d, q) || d.sub_departments.some(u => matchesQuery(u, q)));
  }, [departments, searchQuery]);

  const handleNewDepartment = () => { setEditingDepartment(null); setFormData({ name: '', description: '', room_number: '', dpt_id: '', leader: null, services: [] }); setFormError(''); setFormSuccess(''); setShowModal(true); };
  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({ name: department.name || '', description: department.description || '', room_number: department.room_number || '', dpt_id: department.dpt_id || department.department_id || '', leader: leaderOption(department.leader || department.department_leader), services: department.services || [], is_unit: department.is_unit || false });
    setFormError(''); setFormSuccess(''); setShowModal(true);
  };
  const handleAddUnit = (department: Department) => { setEditingDepartment(null); setFormData({ name: '', description: '', room_number: '', dpt_id: '', leader: null, services: [], is_unit: true, parent_department: department._id }); setFormError(''); setFormSuccess(''); setShowModal(true); };

  const entityLabel = formData?.is_unit ? 'Department unit' : 'Department';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setFormSuccess('');
    if (!formData?.name?.trim()) { setFormError(`${entityLabel} name is required`); return; }
    try { setSubmitting(true); const sd: Record<string, unknown> = { name: formData.name, description: formData.description || '', room_number: formData.room_number || '', dpt_id: formData.dpt_id || '', leader: leaderOption(formData.leader)?._id || null, services: formData.services || [] };
      if (formData?.is_unit) { sd.is_unit = true; if (formData?.parent_department) sd.parent_department = formData.parent_department; }
      if (editingDepartment?._id) {
        const r = await departmentService.update(editingDepartment._id, sd);
        if (r.success) { const msg = r.message || `${entityLabel} updated successfully`; setFormSuccess(msg); showSuccess(msg); setTimeout(() => { setShowModal(false); loadDepartments(false); }, 1500); }
        else { const msg = r.message || `The ${entityLabel.toLowerCase()} could not be updated. Please review the form and try again.`; setFormError(msg); showError(msg); }
      } else {
        const r = await departmentService.create(sd);
        if (r.success) { const msg = r.message || `${entityLabel} created successfully`; setFormSuccess(msg); showSuccess(msg); setTimeout(() => { setShowModal(false); loadDepartments(false); }, 1500); }
        else { const msg = r.message || `The ${entityLabel.toLowerCase()} could not be created. Please review the form and try again.`; setFormError(msg); showError(msg); }
      }
    } catch (err) {
      const msg = errMsg(err, `The ${entityLabel.toLowerCase()} could not be saved. Please review the form and try again.`);
      setFormError(msg); showError(msg);
    } finally { setSubmitting(false); }
  };

  const handleDeleteClick = (id: string, name: string) => { setDeletingId(id); setDeletingName(name); setShowDeleteConfirm(true); };
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      setDeleting(true);
      const r = await departmentService.delete(deletingId);
      if (r?.success === false) { showError(r.message || 'The department could not be deleted. Please try again.'); }
      else { showSuccess(r?.message || 'Department deleted successfully'); }
      setShowDeleteConfirm(false); loadDepartments(false);
    } catch (err) {
      const msg = errMsg(err, 'The department could not be deleted. Please try again.');
      setError(msg); showError(msg);
    } finally { setDeleting(false); setDeletingId(null); setDeletingName(''); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-3 bg-gray-50 p-3 border border-gray-100">
                <div className="w-8 h-8 bg-[rgba(5,109,170,0.1)] flex items-center justify-center"><HiOutlineOfficeBuilding className="w-4 h-4 cok-primary-color" /></div>
                <div><p className="text-xs text-gray-500">Total Departments</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <p className="text-xl font-bold text-gray-900">{totals.departments}</p>}</div>
              </div>
              <div className="inline-flex items-center gap-3 bg-gray-50 p-3 border border-gray-100">
                <div className="w-8 h-8 bg-[rgba(41,128,185,0.08)] flex items-center justify-center"><HiOutlineOfficeBuilding className="w-4 h-4 text-[#2980B9]" /></div>
                <div><p className="text-xs text-gray-500">Total Units</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <p className="text-xl font-bold text-gray-900">{totals.units}</p>}</div>
              </div>
            </div>
            <button onClick={handleNewDepartment} className="inline-flex items-center gap-1.5 px-4 py-2 cok-btn-primary text-white max-w-max text-sm font-semibold"><FiPlus className="w-4 h-4" />Add Department</button>
          </div>

        </div>

        <div className="bg-white border border-gray-200 p-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search departments and units..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 cok-auth-input text-sm" /></div>
            <div className="flex items-center gap-2"><button onClick={() => loadDepartments(false)} className="p-1.5 hover:bg-gray-100 text-gray-600" title="Refresh"><FiRefreshCw className="w-4 h-4" /></button></div>
          </div>
        </div>

        {error && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E74C3C] text-[#E74C3C] px-3 py-2 text-sm flex items-center gap-2"><FiAlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        <div className="bg-white border border-gray-200 overflow-hidden">
          {loading && firstLoad ? <div className="p-8 text-center flex justify-center flex-row items-center text-gray-500"> <SpiralLoader /> </div>
            : filteredDepartments.length === 0 ? <div className="p-8 text-center"><HiOutlineOfficeBuilding className="w-10 h-10 text-gray-400 mx-auto mb-3" /><h3 className="text-sm font-semibold text-gray-900 mb-1">No departments found</h3><p className="text-xs text-gray-500">{searchQuery ? 'Try adjusting your search' : 'Get started by adding your first department'}</p></div>
              : <DepartmentManagementTable departments={filteredDepartments} loading={loading} onEdit={handleEdit} onDelete={handleDeleteClick} onAddUnit={handleAddUnit} onViewDetails={handleEdit} refreshDepartments={() => loadDepartments(false)} />}
        </div>

        {showModal && (
          <OverlayShell
            title={<span className="inline-flex items-center gap-2 max-w-full"><HiOutlineOfficeBuilding className="w-4 h-4 shrink-0 cok-primary-color" /><span className="truncate">{editingDepartment ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</span></span>}
            subtitle={editingDepartment ? `Update ${entityLabel.toLowerCase()} details` : formData?.is_unit ? 'Create a new department unit under the selected department' : 'Create a new department'}
            onClose={() => setShowModal(false)}
            busy={submitting}
            closeOnBackdrop={false}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E74C3C] text-[#E74C3C] px-3 py-2 text-sm flex items-start gap-2"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span></div>}
              {formSuccess && <div className="bg-[rgba(76,175,80,0.08)] border border-[#388E3C] text-[#388E3C] px-3 py-2 text-sm flex items-start gap-2"><FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formSuccess}</span></div>}
              <div><span className={`inline-block text-xs px-2 py-0.5 font-semibold ${formData?.is_unit ? 'bg-[rgba(41,128,185,0.08)] text-[#2980B9]' : 'bg-[rgba(5,109,170,0.1)] text-[#056daa]'}`}>{formData?.is_unit ? 'Department Unit' : 'Department'}</span></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block cok-req">{entityLabel} Name</label><input type="text" required value={formData?.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder={`${entityLabel} name`} /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">{entityLabel} Code (optional)</label><input type="text" value={formData?.dpt_id || ''} onChange={e => setFormData({ ...formData, dpt_id: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., DEP-001" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Room Number</label><input type="text" value={formData?.room_number || ''} onChange={e => setFormData({ ...formData, room_number: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., 101" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label><textarea value={formData?.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 cok-auth-input  text-sm resize-none" rows={2} placeholder="Description" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">{entityLabel} Leader</label><LeaderSearchInput value={leaderOption(formData?.leader)} onChange={leader => setFormData({ ...formData, leader })} disabled={submitting} /></div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting} className="flex-1 px-3 py-2 cok-btn-primary text-white text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : editingDepartment ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </OverlayShell>
        )}

        <ConfirmModal isOpen={showDeleteConfirm} title="Delete Department" message={`Delete "${deletingName}"? This cannot be undone.`} confirmText="Delete" onConfirm={handleConfirmDelete} onCancel={() => setShowDeleteConfirm(false)} type="danger" isLoading={deleting} />
      </div>
    </MainLayout>
  );
};

export default DepartmentsPage;
