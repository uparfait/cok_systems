import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiUsers, FiSearch, FiRefreshCw, FiClock, FiCheckCircle, FiUserPlus } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';

interface Visitor { _id?: string; name?: string; visitorName?: string; phone?: string; department?: string; departmentName?: string; purpose?: string; status?: string; checkInTime?: string; checkIn?: string; checkOutTime?: string; checkOut?: string; }

const ServiceDeliveryDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); else if (isAuthenticated) loadData(); }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setLoading(true); setError('');
    try { const r = await serviceDeliveryService.getAllVisitors(); if (r.status) setVisitors(r.data || []); else setError(r.message || r.error || 'Failed'); }
    catch (err: any) { setError(err?.message || err?.error || 'Failed'); } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadData(); return; }
    setLoading(true);
    try { const r = await serviceDeliveryService.searchVisitors(searchQuery); if (r.status) setVisitors(r.data || []); }
    catch (err: any) { setError(err?.message || 'Failed'); } finally { setLoading(false); }
  };

  const totalVisitors = visitors.length;
  const checkedIn = visitors.filter(v => v.status === 'Inside').length;
  const checkedOut = visitors.filter(v => v.status === 'Left').length;

  if (authLoading || loading) return <div className="flex items-center justify-center h-64"><div className="text-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div><p className="text-sm text-gray-600">Loading...</p></div></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-green-600" />Service Delivery</h1><p className="text-xs text-gray-500 mt-0.5">Manage visitors and service delivery</p></div>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"><FiUserPlus className="w-3.5 h-3.5" />New Visitor</button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[{ label: 'Total Visitors', value: totalVisitors, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-100' }, { label: 'Currently Inside', value: checkedIn, icon: FiClock, color: 'text-green-600', bg: 'bg-green-100' }, { label: 'Checked Out', value: checkedOut, icon: FiCheckCircle, color: 'text-purple-600', bg: 'bg-purple-100' }].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-medium text-gray-500">{s.label}</p><p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p></div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 p-3">
          <div className="flex gap-3">
            <div className="flex-1 relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by name, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
            <button onClick={handleSearch} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium">Search</button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200"><h2 className="text-sm font-semibold text-gray-900">Visitor Records</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50"><tr>{['Name', 'Phone', 'Department', 'Purpose', 'Check In', 'Status'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-200">
                {visitors.slice(0, 10).map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-blue-100 flex items-center justify-center"><FiUsers className="w-3.5 h-3.5 text-blue-600" /></div><span className="text-sm font-medium text-gray-900">{v.name || v.visitorName || 'N/A'}</span></div></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{v.phone || 'N/A'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{v.departmentName || v.department || 'N/A'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{v.purpose || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{v.checkInTime || v.checkIn || 'N/A'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 font-medium ${v.status === 'Inside' ? 'bg-blue-100 text-blue-700' : v.status === 'Left' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>{v.status || 'Waiting'}</span></td>
                  </tr>
                ))}
                {visitors.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">No visitors found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ServiceDeliveryDashboard;