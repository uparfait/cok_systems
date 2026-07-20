import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiUsers, FiSearch, FiRefreshCw, FiClock, FiCheckCircle, FiUserPlus } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const btnStyle: React.CSSProperties = { fontFamily: fontHeading, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", borderRadius: 0 };
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "14px", backgroundColor: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", color: NEUTRAL_DARK };
const focusInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)"; };
const blurInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)"; };

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

  if (authLoading || loading) return <div className="flex items-center justify-center h-64"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: PRIMARY }}></div><p className="text-sm" style={{ color: '#555555' }}>Loading...</p></div></div>;

  return (
    <MainLayout>
      <div className="space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="flex items-center justify-between">
          <div><h1 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: PRIMARY }}><HiOutlineClipboardList className="w-5 h-5" style={{ color: SUCCESS }} />Service Delivery</h1><p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>Manage visitors and service delivery</p></div>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-gray-100 text-xs disabled:opacity-50 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiUserPlus className="w-3.5 h-3.5" />New Visitor</button>
          </div>
        </div>

        {error && <div className="px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(231,76,60,0.08)', border: `1px solid ${DANGER}`, color: DANGER, borderRadius: 0 }}>{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[{ label: 'Total Visitors', value: totalVisitors, icon: FiUsers, color: PRIMARY, bg: 'rgba(5,109,170,0.1)' }, { label: 'Currently Inside', value: checkedIn, icon: FiClock, color: SUCCESS, bg: 'rgba(76,175,80,0.1)' }, { label: 'Checked Out', value: checkedOut, icon: FiCheckCircle, color: ACCENT_DARK_BLUE, bg: 'rgba(41,128,185,0.1)' }].map((s, i) => (
            <div key={i} className="p-4" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-medium" style={{ fontFamily: fontHeading, color: GRAY_DISABLED }}>{s.label}</p><p className="text-xl font-bold mt-0.5" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{s.value}</p></div>
                <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: s.bg, borderRadius: 0 }}><s.icon className="w-5 h-5" style={{ color: s.color }} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="flex gap-3">
            <div className="flex-1 relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} /><input type="text" placeholder="Search by name, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full pl-8 pr-3 py-1.5 text-sm outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <button onClick={handleSearch} className="px-3 py-1.5 bg-transparent hover:bg-gray-100 text-xs transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Search</button>
          </div>
        </div>

        <div className="overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}><h2 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Visitor Records</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: NEUTRAL_LIGHT }}><tr>{['Name', 'Phone', 'Department', 'Purpose', 'Check In', 'Status'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-200">
                {visitors.slice(0, 10).map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}><FiUsers className="w-3.5 h-3.5" style={{ color: PRIMARY }} /></div><span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{v.name || v.visitorName || 'N/A'}</span></div></td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#555555' }}>{v.phone || 'N/A'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#555555' }}>{v.departmentName || v.department || 'N/A'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: GRAY_DISABLED }}>{v.purpose || '-'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: GRAY_DISABLED }}>{v.checkInTime || v.checkIn || 'N/A'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 font-medium" style={{ borderRadius: 0, backgroundColor: v.status === 'Inside' ? 'rgba(76,175,80,0.12)' : v.status === 'Left' ? 'rgba(231,76,60,0.1)' : 'rgba(243,156,18,0.12)', color: v.status === 'Inside' ? SUCCESS : v.status === 'Left' ? DANGER : WARNING }}>{v.status || 'Waiting'}</span></td>
                  </tr>
                ))}
                {visitors.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs" style={{ color: GRAY_DISABLED }}>No visitors found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ServiceDeliveryDashboard;
