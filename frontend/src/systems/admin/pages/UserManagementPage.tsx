import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { userAccountService } from '../../../core/services/adminService';
import type { Employee } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiSearch, FiLock, FiUnlock,FiLoader, FiRefreshCw, FiUsers, FiMail, FiPhone, FiCheck, FiX, FiAlertCircle, FiUser, FiAlertTriangle } from 'react-icons/fi';

interface UserWithLock extends Employee { access_control?: { is_locked?: boolean; reason?: string; last_login_attempt?: number }; is_account_activated?: boolean; }

const UserManagementPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserWithLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserWithLock[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithLock | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    let f = users;
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = users.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.telephone?.toLowerCase().includes(q) || u.department_name?.toLowerCase().includes(q)); }
    setFilteredUsers(f); setTotalUsers(f.length); setTotalPages(Math.ceil(f.length / pageLimit)); setCurrentPage(1);
  }, [searchQuery, users, pageLimit]);

  const loadUsers = async () => { setLoading(true); setError(''); try { const r = await userAccountService.getAllUsers(); if (r.success) { const d = r.data || []; setUsers(d); setFilteredUsers(d); setTotalUsers(d.length); setTotalPages(Math.ceil(d.length / pageLimit)); setCurrentPage(1); } else setError(r.message || 'Failed'); } catch (err: any) { setError(err.response?.data?.message || 'Failed'); } finally { setLoading(false); setfirstLoad(false); } };

  const handleLock = async () => { if (!selectedUser?._id) return; setActionLoading(true); try { const r = await userAccountService.lockUnlock(selectedUser._id, 'lock', lockReason || 'Account locked'); if (r.success) { setUsers(prev => prev.map(u => u._id === selectedUser._id ? { ...u, access_control: { is_locked: true, reason: lockReason || 'Locked' } } : u)); setShowLockModal(false); setSelectedUser(null); } } catch (err) { } finally { setActionLoading(false); } };
  const handleUnlock = async () => { if (!selectedUser?._id) return; setActionLoading(true); try { const r = await userAccountService.lockUnlock(selectedUser._id, 'unlock'); if (r.success) { setUsers(prev => prev.map(u => u._id === selectedUser._id ? { ...u, access_control: { is_locked: false } } : u)); setShowUnlockModal(false); setSelectedUser(null); } } catch (err) { } finally { setActionLoading(false); } };
  const handleResetAttempts = async (u: UserWithLock) => { if (!u._id) return; try { const r = await userAccountService.resetLoginAttempts(u._id); if (r.success) setUsers(prev => prev.map(x => x._id === u._id ? { ...x, access_control: { ...x.access_control, last_login_attempt: 0 } } : x)); } catch (err) { } };

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4"><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiUsers className="w-5 h-5" />User Account Management</h1><p className="text-xs text-gray-600 mt-0.5">Manage user account lock/unlock status</p></div>
        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-end">
          <div className="flex gap-3 items-center">
            <div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-48 pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
            <button onClick={loadUsers} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>
        {error && !loading && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"><FiAlertCircle className="w-4 h-4" />{error}</div>}

        <div className=" p-5 overflow-hidden">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full  divide-y divide-gray-200">
              <thead className="bg-blue-600 sticky top-0 z-10 shadow-sm"><tr>{['User', 'Department', 'Activation', 'Account Lock', 'Actions'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-white uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(loading && firstLoad) ? <tr><td colSpan={5} className="px-4 py-8 text-center"><div className="flex justify-center gap-2"><div className="h-6 w-6 justify-center items-center flex"><FiLoader className="w-5 h-5 animate-spin text-blue-600" /></div></div></td></tr>
                  : paginatedUsers.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">{searchQuery ? 'No matches' : 'No users'}</td></tr>
                    : paginatedUsers.map(u => (
                        <tr key={u._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5"><div className="flex items-center"><div className="w-8 h-8 bg-blue-100 flex items-center justify-center"><FiUser className="w-4 h-4 text-blue-600" /></div><div className="ml-3"><div className="text-sm font-medium text-gray-900">{u.full_name || 'N/A'}</div><div className="text-xs text-gray-500 flex items-center gap-1"><FiMail className="w-3 h-3" />{u.email || 'N/A'}</div>{u.telephone && <div className="text-xs text-gray-500 flex items-center gap-1"><FiPhone className="w-3 h-3" />{u.telephone}</div>}</div></div></td>
                          <td className="px-4 py-2.5 text-sm text-gray-900">{u.department_name || (typeof u.department === 'object' ? (u.department as any)?.department_name : 'N/A')}</td>
                          <td className="px-4 py-2.5">{u.is_account_activated ? <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800"><FiCheck className="w-3 h-3 mr-1" />Activated</span> : <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800"><FiX className="w-3 h-3 mr-1" />Not Activated</span>}</td>
                          <td className="px-4 py-2.5">{u.access_control?.is_locked ? <div><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800"><FiLock className="w-3 h-3 mr-1" />Locked</span>{u.access_control?.reason && <p className="text-xs text-gray-500 mt-1 max-w-48 truncate" title={u.access_control.reason}>{u.access_control.reason}</p>}</div> : <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800"><FiUnlock className="w-3 h-3 mr-1" />Unlocked</span>}</td>
                          <td className="px-4 py-2.5"><div className="flex items-center gap-1.5">{u.access_control?.is_locked ? <button onClick={() => { setSelectedUser(u); setShowUnlockModal(true); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700"><FiUnlock className="w-3 h-3" />Unlock</button> : <button onClick={() => { setSelectedUser(u); setLockReason(''); setShowLockModal(true); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium hover:bg-red-700"><FiLock className="w-3 h-3" />Lock</button>}
                            {u.access_control?.last_login_attempt && u.access_control.last_login_attempt > 0 && <button onClick={() => handleResetAttempts(u)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"><FiRefreshCw className="w-3 h-3" />Reset</button>}</div></td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 1 && <div className="px-4 py-3 bg-gray-50 border-t flex flex-col sm:flex-row justify-between items-center gap-2 text-xs"><span>Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalUsers)} of {totalUsers}</span><div className="flex gap-2"><button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Previous</button><button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Next</button></div></div>}
       

        {showLockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setShowLockModal(false); setSelectedUser(null); setLockReason(''); }} />
            <div className="relative bg-white shadow-2xl w-full max-w-md mx-4">
              <div className="flex items-center justify-between p-3 border-b"><h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><FiLock className="w-4 h-4 text-red-600" />Lock User Account</h3><button onClick={() => { setShowLockModal(false); setSelectedUser(null); setLockReason(''); }} disabled={actionLoading} className="p-1 hover:bg-gray-100 disabled:opacity-50"><FiX className="w-4 h-4 text-gray-500" /></button></div>
              <div className="p-4">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><FiAlertTriangle className="w-6 h-6 text-red-600" /></div>
                <p className="text-sm text-gray-600 mb-3">Lock account for <span className="font-semibold text-gray-900">{selectedUser?.full_name || selectedUser?.email}</span>?</p>
                <div className="mb-4"><label className="text-xs font-medium text-gray-700 mb-1 block">Reason <span className="text-red-500">*</span></label><textarea value={lockReason} onChange={e => setLockReason(e.target.value)} placeholder="Enter reason..." rows={2} className="w-full px-3 py-2 border border-gray-300 text-sm resize-none" disabled={actionLoading} /><p className="text-xs text-gray-500 mt-0.5">Visible to user on login</p></div>
                <div className="flex gap-3"><button onClick={() => { setShowLockModal(false); setSelectedUser(null); setLockReason(''); }} disabled={actionLoading} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1"><FiX className="w-3.5 h-3.5" />Cancel</button><button onClick={handleLock} disabled={actionLoading || !lockReason.trim()} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">{actionLoading ? <><FiLoader className="w-3.5 h-3.5 text-white animate-spin" />Locking...</> : <><FiLock className="w-3.5 h-3.5" />Lock</>}</button></div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal isOpen={showUnlockModal} onCancel={() => { setShowUnlockModal(false); setSelectedUser(null); }} onConfirm={handleUnlock} title="Unlock User Account" message={`Unlock account for ${selectedUser?.full_name || selectedUser?.email}?`} confirmText={actionLoading ? 'Unlocking...' : 'Unlock Account'} cancelText="Cancel" type="info" isLoading={actionLoading} />
      </div>
    </MainLayout>
  );
};

export default UserManagementPage;