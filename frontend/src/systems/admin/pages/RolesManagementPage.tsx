import React, { useState, useEffect } from 'react';
import { roleService, type Role, type CreateRoleInput } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiShield, FiCheck, FiX, FiAlertCircle, FiChevronDown, FiChevronRight, FiLoader } from 'react-icons/fi';

interface ResourceAction { action: string; description?: string; is_enabled: boolean; }
interface ResourcePermission { resource_name: string; actions: ResourceAction[]; }
interface AvailableResource { resource_name: string; actions: Array<{ action: string; description?: string }>; }

const RolesManagementPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [resources, setResources] = useState<AvailableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  useEffect(() => { loadRoles(); loadResources(); }, []);
  useEffect(() => { setFilteredRoles(searchQuery.trim() ? roles.filter(r => r.role_name?.toLowerCase().includes(searchQuery.toLowerCase())) : roles); }, [searchQuery, roles]);

  const loadRoles = async () => { setLoading(true); try { const r = await roleService.getAll(); if (r.success) { setRoles(r.data || []); setFilteredRoles(r.data || []); } else setError(r.message || 'Failed'); } catch (err: any) { setError(err.message); } finally { setLoading(false); setfirstLoad(false); } };
  const loadResources = async () => { try { const r = await roleService.getAvailableResources(); if (r.success && r.data) setResources(r.data); } catch (err) { } };

  const togglePerm = (key: string, isEdit: boolean) => { const setter = isEdit ? setEditPerms : setSelectedPerms; setter((prev: string[]) => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]); };
  const isSelected = (key: string, isEdit: boolean) => isEdit ? editPerms.includes(key) : selectedPerms.includes(key);

  const buildPermissions = (perms: string[]) => {
    const map = new Map<string, string[]>();
    perms.forEach(p => { const idx = p.indexOf(':'); if (idx > 0) { const r = p.substring(0, idx), a = p.substring(idx + 1); if (!map.has(r)) map.set(r, []); map.get(r)!.push(a); } });
    return Array.from(map, ([resource_name, actions]) => ({ resource_name, actions }));
  };

  const handleCreate = async () => {
    if (!roleName.trim()) return; setActionLoading(true);
    try { const r = await roleService.create({ role_name: roleName.trim(), permissions: buildPermissions(selectedPerms) }); if (r.success) { setShowCreate(false); setRoleName(''); setSelectedPerms([]); loadRoles(); } else showError(r.message || 'Failed'); }
    catch (err) { } finally { setActionLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selectedRole?._id || !roleName.trim()) return; setActionLoading(true);
    try { const r = await roleService.update(selectedRole._id, { role_name: roleName.trim(), permissions: buildPermissions(editPerms) }); if (r.success) { setShowEdit(false); setSelectedRole(null); loadRoles(); } }
    catch (err) { } finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!selectedRole?._id) return; setActionLoading(true);
    try { const r = await roleService.delete(selectedRole._id); if (r.success) { setShowDelete(false); setSelectedRole(null); loadRoles(); } else showError(r.message || 'Failed'); }
    catch (err) { } finally { setActionLoading(false); }
  };

  const toggleResource = (name: string) => { setExpandedResources(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; }); };
  const selectAll = (resName: string, isEdit: boolean) => {
    const res = resources.find(r => r.resource_name === resName); if (!res) return;
    const perms = res.actions.map(a => `${resName}:${a.action}`);
    const setter = isEdit ? setEditPerms : setSelectedPerms;
    setter((prev: string[]) => { const n = [...prev]; perms.forEach(p => { if (!n.includes(p)) n.push(p); }); return n; });
  };
  const deselectAll = (resName: string, isEdit: boolean) => {
    const setter = isEdit ? setEditPerms : setSelectedPerms;
    setter((prev: string[]) => prev.filter(p => !p.startsWith(`${resName}:`)));
  };
  const getCount = (role: Role) => role.permissions?.reduce((c, r: any) => c + r.actions.filter((a: any) => a.is_enabled).length, 0) || 0;

  const renderPermissionModal = (isEdit: boolean) => {
    const perms = isEdit ? editPerms : selectedPerms;
    const setter = isEdit ? setEditPerms : setSelectedPerms;
    return (
      <div className="max-h-96 overflow-y-auto text-left">
        <div className="mb-3"><label className="text-xs font-medium text-gray-700 mb-1 block">Role Name</label><input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="Enter role name" className="w-full px-3 py-2 border border-gray-300 text-sm" autoFocus /></div>
        <div><div className="flex items-center justify-between mb-2"><label className="text-xs font-medium text-gray-700">Permissions ({perms.length} selected)</label><div className="flex gap-2"><button type="button" onClick={() => setter(resources.flatMap(r => r.actions.map(a => `${r.resource_name}:${a.action}`)))} className="text-xs text-blue-600 font-medium">Select All</button><span className="text-gray-300">|</span><button type="button" onClick={() => setter([])} className="text-xs text-gray-600 font-medium">Deselect All</button></div></div>
          <div className="space-y-1.5">{resources.map(r => { const isExp = expandedResources.has(r.resource_name); const cnt = r.actions.filter(a => isSelected(`${r.resource_name}:${a.action}`, isEdit)).length; return (
            <div key={r.resource_name} className="bg-gray-50 border border-gray-200">
              <button type="button" onClick={() => toggleResource(r.resource_name)} className="w-full flex items-center justify-between p-2.5 hover:bg-gray-100"><div className="flex items-center gap-2">{isExp ? <FiChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <FiChevronRight className="w-3.5 h-3.5 text-gray-500" />}<span className="text-xs font-medium text-gray-900">{r.resource_name}</span>{cnt > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5">{cnt}</span>}</div></button>
              {isExp && <div className="px-3 pb-2.5 border-t border-gray-200"><div className="pt-2 flex justify-end gap-2 mb-2"><button type="button" onClick={() => selectAll(r.resource_name, isEdit)} className="text-xs text-blue-600 font-medium">Select All</button><span className="text-gray-300">|</span><button type="button" onClick={() => deselectAll(r.resource_name, isEdit)} className="text-xs text-gray-600 font-medium">Deselect</button></div>
                <div className="grid grid-cols-1 gap-1">{r.actions.map(a => <label key={a.action} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={isSelected(`${r.resource_name}:${a.action}`, isEdit)} onChange={() => togglePerm(`${r.resource_name}:${a.action}`, isEdit)} className="w-3.5 h-3.5 text-blue-600 border-gray-300" />{a.description && <p className="text-xs text-gray-500">{a.description}</p>}</label>)}</div></div>}
            </div>); })}</div></div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4"><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiShield className="w-5 h-5" />Roles Management</h1><p className="text-xs text-gray-600 mt-0.5">Create, edit, and manage roles with permissions</p></div>
        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="relative flex-1 max-w-md"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search roles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
          <div className="flex gap-2"><button onClick={loadRoles} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button><button onClick={() => { setRoleName(''); setSelectedPerms([]); setShowCreate(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><FiPlus className="w-3.5 h-3.5" />Create Role</button></div>
        </div>
        {error && !loading && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"><FiAlertCircle className="w-4 h-4" />{error}</div>}
        <div className="space-y-3">
          {(loading && firstLoad) ? <div className="bg-white border p-8 text-center"><div className="h-6 w-6 mx-auto"><FiLoader className="w-5 h-5 animate-spin text-blue-600" /></div><p className="text-sm text-gray-500 mt-2">Loading...</p></div>
            : filteredRoles.length === 0 ? <div className="bg-white border p-8 text-center text-sm text-gray-500">{searchQuery ? 'No roles found' : 'No roles available'}</div>
              : filteredRoles.map(role => (
                  <div key={role._id} className="bg-white border overflow-hidden">
                    <div className="p-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-100 flex items-center justify-center"><FiShield className="w-4 h-4 text-blue-600" /></div><div><h3 className="text-sm font-semibold text-gray-900">{role.role_name}</h3><p className="text-xs text-gray-500">{getCount(role)} permissions</p></div></div>
                      <div className="flex items-center gap-1.5"><button onClick={() => { setSelectedRole(role); setRoleName(role.role_name || ''); const perms: string[] = []; role.permissions?.forEach((r: any) => r.actions.forEach((a: any) => { if (a.is_enabled) perms.push(`${r.resource_name}:${a.action}`); })); setEditPerms(perms); setShowEdit(true); }} className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"><FiEdit2 className="w-3 h-3 inline mr-1" />Edit</button>
                        <button onClick={() => { setSelectedRole(role); setShowDelete(true); }} className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200"><FiTrash2 className="w-3 h-3 inline mr-1" />Delete</button></div>
                    </div>
                    {role.permissions && role.permissions.length > 0 && <div className="p-3 bg-gray-50"><h4 className="text-xs font-medium text-gray-700 mb-2">Permissions</h4><div className="space-y-1.5">{(role.permissions as ResourcePermission[]).map(p => { const ec = p.actions.filter(a => a.is_enabled).length; return (
                      <div key={p.resource_name} className="bg-white border border-gray-200">
                        <button onClick={() => toggleResource(p.resource_name)} className="w-full flex items-center justify-between p-2 hover:bg-gray-50"><div className="flex items-center gap-2">{expandedResources.has(p.resource_name) ? <FiChevronDown className="w-3 h-3 text-gray-500" /> : <FiChevronRight className="w-3 h-3 text-gray-500" />}<span className="text-xs font-medium text-gray-900">{p.resource_name}</span><span className="text-xs text-gray-500">({ec}/{p.actions.length})</span></div></button>
                        {expandedResources.has(p.resource_name) && <div className="px-3 pb-2 border-t"><div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">{p.actions.map(a => <div key={a.action} className="flex items-center justify-between p-1.5 bg-gray-50"><p className="text-xs font-medium text-gray-900 truncate">{a.action}</p><button onClick={async () => { const r = await roleService.togglePermission(role._id!, p.resource_name, a.action, !a.is_enabled); if (r.success) loadRoles(); }} className={`p-1 ${a.is_enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>{a.is_enabled ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}</button></div>)}</div></div>}
                      </div>); })}</div></div>}
                  </div>
                ))}
        </div>
        <div className="mt-3 text-xs text-gray-500">Showing {filteredRoles.length} of {roles.length} roles</div>

        <ConfirmModal isOpen={showCreate} onCancel={() => setShowCreate(false)} onConfirm={handleCreate} title="Create New Role" message={renderPermissionModal(false)} confirmText={actionLoading ? 'Creating...' : 'Create Role'} cancelText="Cancel" type="info" isLoading={actionLoading} />
        <ConfirmModal isOpen={showEdit} onCancel={() => setShowEdit(false)} onConfirm={handleUpdate} title="Edit Role" message={renderPermissionModal(true)} confirmText={actionLoading ? 'Updating...' : 'Update Role'} cancelText="Cancel" type="info" isLoading={actionLoading} />
        <ConfirmModal isOpen={showDelete} onCancel={() => setShowDelete(false)} onConfirm={handleDelete} title="Delete Role" message={`Delete "${selectedRole?.role_name}"? Cannot be undone.`} confirmText={actionLoading ? 'Deleting...' : 'Delete Role'} cancelText="Cancel" type="danger" isLoading={actionLoading} />
      </div>
    </MainLayout>
  );
};

export default RolesManagementPage;