import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FiSearch, FiFile, FiFileText, FiEdit, FiFilter, FiCheck, FiArrowRight, FiUser, FiCheckCircle, FiX, FiMoreVertical, FiZap, FiClock, FiUsers, FiArrowRightCircle, FiUserCheck, FiCheckSquare, FiRefreshCw, FiMapPin, FiTrendingUp } from "react-icons/fi";
import type { AssignedVisitor } from "./sub/AssignedVisitorsHelpers";
import { statusConfig, getDisplayStatus, getOfficerName, isOfficerAccepted, isServiceCompleted, getInitials, getColorFromName } from "./sub/AssignedVisitorsHelpers";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface AssignedVisitorsListProps { visitors?: AssignedVisitor[]; }

const AssignedVisitorsList: React.FC<AssignedVisitorsListProps> = ({ visitors: propVisitors }) => {
  const [visitors, setVisitors] = useState<AssignedVisitor[]>(propVisitors || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVisitor, setSelectedVisitor] = useState<AssignedVisitor | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<AssignedVisitor | null>(null);
  const [activeVisitorId, setActiveVisitorId] = useState<string | null>(null);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchTermRef = useRef("");
  const itemsPerPage = 5;

  useEffect(() => { if (propVisitors) setVisitors(propVisitors); }, [propVisitors]);

  const handleRowClick = (visitor: AssignedVisitor) => { setActiveVisitorId(visitor.id); setSelectedVisitor(visitor); setShowServicePanel(true); };
  const handleClosePanel = () => { setShowServicePanel(false); setActiveVisitorId(null); setSelectedVisitor(null); setEditingVisitor(null); };
  const handleSaveEdit = () => { if (editingVisitor) { setVisitors(prev => prev.map(v => v.id === editingVisitor.id ? editingVisitor : v)); setSelectedVisitor(editingVisitor); setEditingVisitor(null); } };
  const handleEditClick = (visitor: AssignedVisitor) => setEditingVisitor({ ...visitor });

  const filteredVisitors = useMemo(() => visitors.filter(visitor => {
    const matchesSearch = !searchTerm ? true : visitor.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || visitor.nationalId?.includes(searchTerm) || visitor.phone?.includes(searchTerm);
    return matchesSearch && (statusFilter === 'all' ? true : getDisplayStatus(visitor) === statusFilter);
  }), [visitors, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const handleSearch = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearching(true); setCurrentPage(1); setStatusFilter('all'); lastSearchTermRef.current = searchTerm;
    setTimeout(() => setIsSearching(false), 300);
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm === lastSearchTermRef.current) return;
    lastSearchTermRef.current = searchTerm;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchTerm.trim()) { setStatusFilter('all'); return; }
    searchTimeoutRef.current = setTimeout(() => { setIsSearching(true); setCurrentPage(1); setStatusFilter('all'); setTimeout(() => setIsSearching(false), 300); }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm]);

  const handleExportPDF = () => {
    const htmlContent = `
      <html><head><style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#1a365d}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:12px;text-align:left}th{background-color:#1a365d;color:white}.footer{margin-top:20px;text-align:center;color:#666;font-size:12px}</style></head>
      <body><h1>Assigned Visitors Tracking Report</h1><p>Generated on: ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>#</th><th>Visitor Name</th><th>National ID</th><th>Service</th><th>Department</th><th>Assignment Time</th><th>Status</th></tr></thead>
      <tbody>${filteredVisitors.map((v, i) => `<tr><td>${i + 1}</td><td>${v.fullName || ''}</td><td>${v.nationalId || ''}</td><td>${v.service || ''}</td><td>${v.department || ''}</td><td>${v.assignmentTime || ''}</td><td>${statusConfig[v.status as keyof typeof statusConfig]?.label || v.status || ''}</td></tr>`).join('')}</tbody></table>
      <div class="footer"><p>Total Visitors: ${filteredVisitors.length}</p><p>City of Kigali - Visitor Management System</p></div></body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) { printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.print(); }
  };

  const handleExportExcel = () => {
    const headers = ['#', 'Visitor Name', 'National ID', 'Service', 'Department', 'Assignment Time', 'Status'];
    const rows = filteredVisitors.map((v, i) => [i + 1, v.fullName || '', v.nationalId || '', v.service || '', v.department || '', v.assignmentTime || '', statusConfig[v.status as keyof typeof statusConfig]?.label || v.status || '']);
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `assigned_visitors_${new Date().toISOString().split('T')[0]}.xls`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Assigned Visitors Tracking</h1>
        <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>Manage real-time visitor flow and service assignments across all government departments.</p>
      </div>

      <div className="relative min-h-[calc(100vh-200px)]">
        <div className={`${showServicePanel && selectedVisitor ? 'w-[calc(100%-320px)]' : 'w-full'} space-y-4 pr-4 transition-all duration-300`}>
          <div className="p-3" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 flex gap-2 w-full">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: GRAY_DISABLED }} />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search by visitor name, ID or badge..." className="w-full pl-9 pr-3 py-1.5 outline-none transition-all" style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }} onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                </div>
                <button onClick={handleSearch} className="px-3 py-1.5 flex items-center gap-1.5 shadow-sm transition-colors" style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiSearch className="w-3.5 h-3.5" />Search</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'accepted', 'completed', 'transferred', 'inprogress', 'waiting'] as const).map((filter) => (
                  <button key={filter} onClick={() => setStatusFilter(filter)} className="px-3 py-1.5 transition-colors" style={{ fontFamily: fontHeading, fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', borderRadius: 0, backgroundColor: statusFilter === filter ? PRIMARY : WHITE, color: statusFilter === filter ? WHITE : '#555555', border: statusFilter === filter ? '1px solid transparent' : `1px solid ${BORDER}` }}>
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: NEUTRAL_LIGHT }}>
                  <tr>
                    {['VISITOR NAME', 'IDENTITY', 'BADGE NUMBER', 'DEPARTMENT', 'ASSIGNMENT TIME', 'STATUS'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2.5" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedVisitors.length > 0 ? paginatedVisitors.map((visitor) => {
                    const displayStatus = getDisplayStatus(visitor);
                    const status = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.waiting;
                    const isActive = activeVisitorId === visitor.id;
                    return (
                      <tr key={visitor.id} onClick={() => handleRowClick(visitor)} className={`cursor-pointer transition-colors ${isActive ? 'bg-[rgba(5,109,170,0.08)] border-l-4 border-l-[#056daa] shadow-sm' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 ${getColorFromName(visitor.fullName)} flex items-center justify-center text-white text-xs font-medium`}>{getInitials(visitor.fullName)}</div>
                            <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.fullName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><p className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.identity || '___'}</p></td>
                        <td className="px-3 py-2.5"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[rgba(5,109,170,0.1)] text-[#056daa]">{visitor.badgeNumber || '___'}</span></td>
                        <td className="px-3 py-2.5"><p className="text-xs" style={{ color: '#555555' }}>{visitor.department}</p></td>
                        <td className="px-3 py-2.5"><p className="text-xs" style={{ color: '#555555' }}>{visitor.assignmentTime}</p></td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                            <span className={`w-1.5 h-1.5 ${status.dot}`}></span>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: GRAY_DISABLED }}>No visitors found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredVisitors.length > 0 && (
              <div className="px-3 py-3 flex justify-between items-center" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                <p className="text-xs" style={{ color: '#555555' }}>Showing {paginatedVisitors.length} of {filteredVisitors.length} results</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs bg-transparent hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ border: `1px solid ${BORDER}`, borderRadius: 0, color: '#555555' }}>Previous</button>
                  <span className="text-xs py-1 px-2" style={{ color: '#555555' }}>Page {currentPage} of {totalPages || 1}</span>
                  <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 text-xs bg-transparent hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ border: `1px solid ${BORDER}`, borderRadius: 0, color: '#555555' }}>Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {showServicePanel && selectedVisitor && (
          <div className="fixed right-0 top-0 h-full z-40 overflow-hidden" style={{ width: '320px', backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="absolute inset-0" style={{ backgroundColor: WHITE }}></div>
            <div className="relative h-full flex flex-col">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: WHITE }}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5" style={{ backgroundColor: PRIMARY, borderRadius: 0 }}>
                    <FiTrendingUp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Tracking</span>
                </div>
                <button onClick={handleClosePanel} className="p-1 hover:bg-gray-100"><FiX className="w-3.5 h-3.5 text-gray-600" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: ACCENT_DARK_BLUE, borderRadius: 0 }}>
                      <span className="text-xs font-bold text-white">{getInitials(selectedVisitor?.fullName || '')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: NEUTRAL_DARK }}>{selectedVisitor?.fullName}</p>
                      <p className="text-xs truncate" style={{ color: GRAY_DISABLED }}>{selectedVisitor?.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E0E0E0]">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 ${isServiceCompleted(selectedVisitor!) ? 'bg-[#4CAF50]' : isOfficerAccepted(selectedVisitor!) ? 'bg-[#056daa] animate-pulse' : 'bg-[#F39C12] animate-pulse'}`}></div>
                      <span className="text-xs font-medium" style={{ color: '#555555' }}>{isServiceCompleted(selectedVisitor!) ? 'Completed' : isOfficerAccepted(selectedVisitor!) ? 'In Progress' : 'Waiting'}</span>
                    </div>
                    <div className="text-right"><p className="text-xs" style={{ color: GRAY_DISABLED }}>Checked In</p><p className="text-xs font-semibold" style={{ color: '#555555' }}>{selectedVisitor?.checkedInTime || '---'}</p></div>
                  </div>
                </div>

                <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                  <p className="mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Progress</p>
                  <div className="relative">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-[#E0E0E0]"></div>
                    <div className="space-y-2">
                      {[{ label: 'Checked In', time: selectedVisitor?.checkedInTime || '---', sub: selectedVisitor?.checkedInGate || 'Gate', done: true, icon: FiCheck },
                        { label: 'Transferred', time: selectedVisitor?.assignmentTime || '---', sub: `To ${selectedVisitor?.department?.split(' ')[0] || 'Dept'}`, done: isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!), icon: FiArrowRightCircle },
                        { label: 'Officer Accepted', time: getOfficerName(selectedVisitor!), sub: undefined, done: isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!), icon: FiUserCheck },
                        { label: 'Completed', time: '✓ Service done', sub: undefined, done: isServiceCompleted(selectedVisitor!), icon: FiCheckSquare }].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 relative">
                          <div className={`w-6 h-6 flex items-center justify-center z-10 shadow-sm ${step.done ? 'bg-[#4CAF50]' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'bg-white border-2 border-[#056daa]' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'bg-[#056daa]' : 'bg-gray-100'}`}>
                            <step.icon className={`w-3 h-3 ${step.done ? 'text-white' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'text-[#056daa]' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <div className={`flex-1 p-1.5 shadow-sm ${step.done ? 'bg-[rgba(76,175,80,0.1)]' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'bg-[rgba(5,109,170,0.08)]' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'bg-[rgba(5,109,170,0.08)]' : 'bg-white'}`}>
                            <p className={`text-xs font-semibold ${step.done ? 'text-[#388E3C]' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'text-[#056daa]' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'text-[#056daa]' : 'text-gray-400'}`}>{step.label}</p>
                            {step.sub && <p className="text-xs text-gray-500">{step.sub}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedVisitorsList;