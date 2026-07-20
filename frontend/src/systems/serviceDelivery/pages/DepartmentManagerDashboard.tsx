import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSearch, FiUser, FiUsers, FiCheckCircle, FiX, FiTrendingUp, FiMessageSquare, FiClock, FiRefreshCw, FiPlus, FiEye, FiEdit, FiArrowRightCircle, FiFileText, FiBriefcase } from "react-icons/fi";
import { serviceDeliveryService, employeeService, departmentService, departmentManagerService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";
import Table from "../../../core/components/Table";
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import { ViewEmployeeModal, EditEmployeeModal } from "./sub/DeptManagerEmployeeModals";
import { AddEmployeeModal } from "./sub/DeptManagerEmployeeModals";
import ServeVisitorModal from "../components/employeeFlow/ServeVisitorModal";
import LiveTimer from "./sub/DeptManagerLiveTimer";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const btnStyle: React.CSSProperties = { fontFamily: fontHeading, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", borderRadius: 0 };
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "14px", backgroundColor: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", color: NEUTRAL_DARK };
const focusInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)"; };
const blurInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)"; };

interface Visitor { _id?: string; full_name?: string; telephone?: string; email?: string; entry_date?: string | Date; is_still_inhouse?: boolean; departments_assigned?: any[]; services_status?: any[]; durations?: any; status?: string; }
interface Employee { _id?: string; employee_id?: string; full_name?: string; name?: string; email?: string; telephone?: string; phone?: string; title?: string; gender?: string; }

const RequestsTable: React.FC<{ status: 'pending' | 'active' | 'completed'; title: string; departmentId: string; showError: (m: string) => void; setSelectedActiveTask: (t: any) => void; setShowActiveTaskModal: (s: boolean) => void; setTransferVisitor: (v: any) => void; setShowTransferModal: (s: boolean) => void; showInfo: (m: string) => void; getInitials: (n: string) => string; }> = ({ status, title, showError, setSelectedActiveTask, setShowActiveTaskModal, setTransferVisitor, setShowTransferModal, showInfo, getInitials }) => {
  const [requests, setRequests] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [dateFilter, setDateFilter] = useState('');
  const fetchR = async (cp = 1, f = '') => { setLoading(true); try { const r = await departmentManagerService.getVisitorsByStatus(status, cp, 20, f); if (r.success && r.data) { setRequests(r.data); setTotal(r.total || 0); setPage(cp); } else { setRequests([]); setTotal(0); } } catch (error) { showError(`Failed to load`); setRequests([]); } finally { setLoading(false); } };
  useEffect(() => { fetchR(1, dateFilter); }, [status]);
  return (
    <div className="overflow-hidden flex flex-col" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
      <div className="flex items-center justify-between p-4" style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}><h2 className="text-sm font-bold uppercase" style={{ fontFamily: fontHeading, color: PRIMARY }}>{title}</h2><div className="flex items-center gap-2"><div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} /><input type="text" placeholder="Search..." className="pl-8 pr-3 py-1.5 text-sm outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div><button className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors" style={{ ...btnStyle, backgroundColor: SUCCESS, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}><FiSearch className="w-3.5 h-3.5" />Search</button><select value={dateFilter} onChange={e => { setDateFilter(e.target.value); fetchR(1, e.target.value); }} className="px-2.5 py-1.5 text-sm outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="">All Time</option><option value="today">Today</option><option value="yesterday">Yesterday</option></select><button onClick={() => fetchR(page, dateFilter)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button></div></div>
      <div className="overflow-x-auto">{loading ? <div className="flex items-center justify-center p-8 min-h-[300px]"><div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto mb-3" style={{ borderColor: PRIMARY }}></div><p className="text-sm" style={{ color: '#555555' }}>Loading...</p></div> : requests.length === 0 ? <div className="flex items-center justify-center p-8 min-h-[300px]"><div className="text-center"><FiFileText className="w-8 h-8 mx-auto mb-3" style={{ color: GRAY_DISABLED }} /><p className="text-sm font-medium" style={{ color: '#555555' }}>No {status} requests</p></div></div>
        : <table className="w-full min-w-[900px]"><thead className="sticky top-0 z-10" style={{ backgroundColor: NEUTRAL_LIGHT }}><tr>{['VISITOR', 'CONTACT', 'DEPARTMENT', 'PROVIDER', 'ENTRY TIME', 'STATUS', status === 'active' ? 'DURATION' : '', (status === 'pending' || status === 'active') ? 'ACTION' : ''].filter(Boolean).map(h => <th key={h} className="text-left text-xs font-semibold uppercase px-3 py-2.5" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">{requests.map((r: any) => <tr key={r._id} className="hover:bg-gray-50"><td className="px-3 py-2.5"><div className="flex items-center"><div className="w-7 h-7 flex items-center justify-center font-bold text-xs mr-2" style={{ backgroundColor: 'rgba(5,109,170,0.1)', color: PRIMARY, borderRadius: 0 }}>{getInitials(r.full_name || '?')}</div><span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK }}>{r.full_name || 'Unknown'}</span></div></td>
            <td className="px-3 py-2.5 text-xs" style={{ color: '#555555' }}>{r.telephone || '_____'}</td>
            <td className="px-3 py-2.5 text-xs" style={{ color: '#555555' }}>{r.departments_assigned?.[0]?.department_name || 'Unknown'}</td>
            <td className="px-3 py-2.5 text-xs" style={{ color: '#555555' }}>{r.departments_assigned?.[0]?.provider_name || 'Unassigned'}</td>
            <td className="px-3 py-2.5 text-xs" style={{ color: '#555555' }}>{r.entry_date ? new Date(r.entry_date).toLocaleString() : 'N/A'}</td>
            <td className="px-3 py-2.5"><span className="text-xs px-2 py-0.5 font-bold uppercase" style={{ borderRadius: 0, backgroundColor: status === 'pending' ? 'rgba(243,156,18,0.12)' : status === 'active' ? 'rgba(5,109,170,0.1)' : 'rgba(158,158,158,0.12)', color: status === 'pending' ? WARNING : status === 'active' ? PRIMARY : '#555555' }}>{status === 'pending' ? 'Not Started' : status === 'active' ? 'In Progress' : 'Completed'}</span></td>
            {status === 'active' && <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold" style={{ borderRadius: 0, backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY }}><FiClock className="w-3 h-3" /><LiveTimer startTime={r.entry_date} /></span></td>}
            {(status === 'pending' || status === 'active') && <td className="px-3 py-2.5">{status === 'pending' ? <button onClick={() => { setSelectedActiveTask(r); setShowActiveTaskModal(true); }} className="flex items-center justify-center h-7 w-16 text-xs transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Details</button> : <button onClick={() => { setTransferVisitor(r); setShowTransferModal(true); showInfo(`Preparing transfer...`); }} className="flex items-center justify-center h-7 w-20 text-xs transition-colors" style={{ ...btnStyle, backgroundColor: ACCENT_DARK_BLUE, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#21618C'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK_BLUE; }}><FiArrowRightCircle className="w-3 h-3 mr-1" />Transfer</button>}</td>}
          </tr>)}</tbody></table>}</div>
      {total > 0 && <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}><div className="flex items-center justify-between text-xs"><span style={{ color: '#555555' }}>Showing {((page-1)*20)+1} to {Math.min(page*20, total)} of {total}</span><div className="flex gap-2"><button onClick={() => fetchR(page-1, dateFilter)} disabled={page===1||loading} className="px-3 py-1 bg-transparent hover:bg-gray-50 disabled:opacity-50 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>← Previous</button><span className="px-2 py-1 text-xs font-medium" style={{ borderRadius: 0, backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY }}>{page}</span><button onClick={() => fetchR(page+1, dateFilter)} disabled={page*20>=total||loading} className="px-3 py-1 bg-transparent hover:bg-gray-50 disabled:opacity-50 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Next →</button></div></div></div>}
    </div>
  );
};

const DepartmentManagerDashboard: React.FC = () => {
  const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth(); const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const departmentId = (user as any)?.departmentId || (user as any)?.department_id || '';
  const departmentName = (user as any)?.departmentName || (user as any)?.department_name || '';
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<any>('dashboard');
  const [visitors, setVisitors] = useState<Visitor[]>([]); const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); const [firstLoad, setFirstLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); const [employeeSearch, setEmployeeSearch] = useState("");
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState<Employee | null>(null);
  const [showActiveTaskModal, setShowActiveTaskModal] = useState(false);
  const [selectedActiveTask, setSelectedActiveTask] = useState<any>(null);
  const [showServeModal, setShowServeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<any>(null);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [firstLoadDeps, setFirstLoadDeps] = useState(true); // placeholder

  useEffect(() => { const t = searchParams.get('tab'); const valid = ['dashboard','employees','departments','feedback','by-department','by-provider','availability','active-tasks','completed-requests']; setActiveTab(t && valid.includes(t) ? t : 'dashboard'); }, [searchParams]);
  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [isAuthenticated, authLoading, navigate]);

  const navigateToTab = (tab: string) => { setActiveTab(tab); setSearchParams({ tab }); };
  const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';

  return (
    <div className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-4 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {['dashboard','employees','departments','feedback','active-tasks','completed-requests','by-department','by-provider','availability'].map(t => (
          <button key={t} onClick={() => navigateToTab(t)} className="px-3 py-1.5 text-xs transition-colors" style={{ ...btnStyle, letterSpacing: '0.5px', backgroundColor: activeTab === t ? PRIMARY : WHITE, color: activeTab === t ? WHITE : NEUTRAL_DARK, border: `1px solid ${activeTab === t ? PRIMARY : BORDER}` }}>{t.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {['Pending','Active','Completed','Feedback'].map(s => <div key={s} className="p-4" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}><div className="text-xs uppercase" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>{s}</div><div className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>0</div></div>)}
          </div>
          <RequestsTable status="pending" title="Pending Requests" departmentId={departmentId} showError={showError} setSelectedActiveTask={setSelectedActiveTask} setShowActiveTaskModal={setShowActiveTaskModal} setTransferVisitor={setTransferVisitor} setShowTransferModal={setShowTransferModal} showInfo={showInfo} getInitials={getInitials} />
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Department Employees</h2><div className="flex gap-2"><div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} /><input type="text" placeholder="Search..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm w-48 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div><button onClick={() => setShowAddEmployeeModal(true)} className="px-3 py-1.5 text-xs flex items-center gap-1 transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiPlus className="w-3.5 h-3.5" />Add</button></div></div>
          <div className="overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <table className="w-full min-w-[600px]"><thead style={{ backgroundColor: NEUTRAL_LIGHT }}><tr>{['Employee','Email','Telephone','Title','Actions'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{h}</th>)}</tr></thead>
              <tbody className="divide-y">{employees.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>No employees</td></tr>
                : employees.map((e: any) => <tr key={e._id} className="hover:bg-gray-50"><td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 flex items-center justify-center font-bold text-xs" style={{ backgroundColor: 'rgba(5,109,170,0.1)', color: PRIMARY, borderRadius: 0 }}>{(e.full_name||'E').charAt(0)}</div><span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{e.full_name}</span></div></td><td className="px-4 py-2.5 text-xs" style={{ color: '#555555' }}>{e.email}</td><td className="px-4 py-2.5 text-xs" style={{ color: '#555555' }}>{e.telephone||'-'}</td><td className="px-4 py-2.5 text-xs" style={{ color: '#555555' }}>{e.title||'-'}</td><td className="px-4 py-2.5"><div className="flex gap-1"><button onClick={() => { setSelectedDeptEmployee(e); setShowViewEmployeeModal(true); }} className="p-1.5 hover:bg-[rgba(5,109,170,0.08)] transition-colors" style={{ color: PRIMARY, borderRadius: 0 }}><FiEye className="w-3.5 h-3.5" /></button><button onClick={() => { setSelectedDeptEmployee(e); setShowEditEmployeeModal(true); }} className="p-1.5 hover:bg-[rgba(76,175,80,0.08)] transition-colors" style={{ color: SUCCESS, borderRadius: 0 }}><FiEdit className="w-3.5 h-3.5" /></button></div></td></tr>)}</tbody></table>
          </div>
        </div>
      )}

      {/* Other tabs will render their content */}
      {activeTab === 'departments' && <DepartmentAvailabilityTab />}
      {activeTab === 'feedback' && <div className="text-sm p-8 text-center" style={{ color: GRAY_DISABLED }}>Feedback tab - uses APIs</div>}
      {activeTab === 'active-tasks' && <div className="text-sm p-8 text-center" style={{ color: GRAY_DISABLED }}>Active tasks tab</div>}
      {activeTab === 'completed-requests' && <RequestsTable status="completed" title="Completed Requests" departmentId={departmentId} showError={showError} setSelectedActiveTask={setSelectedActiveTask} setShowActiveTaskModal={setShowActiveTaskModal} setTransferVisitor={setTransferVisitor} setShowTransferModal={setShowTransferModal} showInfo={showInfo} getInitials={getInitials} />}
      {activeTab === 'by-department' && <div className="text-sm p-8 text-center" style={{ color: GRAY_DISABLED }}>By department view</div>}
      {activeTab === 'by-provider' && <div className="text-sm p-8 text-center" style={{ color: GRAY_DISABLED }}>By provider view</div>}
      {activeTab === 'availability' && <DepartmentAvailabilityTab />}

      <AddEmployeeModal isOpen={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(false)} departmentId={departmentId} departmentName={departmentName} onSuccess={() => { showSuccess('Employee added'); setShowAddEmployeeModal(false); }} />
      <ViewEmployeeModal isOpen={showViewEmployeeModal} onClose={() => setShowViewEmployeeModal(false)} employee={selectedDeptEmployee} />
      <EditEmployeeModal isOpen={showEditEmployeeModal} onClose={() => setShowEditEmployeeModal(false)} employee={selectedDeptEmployee} onSuccess={() => { showSuccess('Employee updated'); setShowEditEmployeeModal(false); }} />
    </div>
  );
};

export default DepartmentManagerDashboard;
