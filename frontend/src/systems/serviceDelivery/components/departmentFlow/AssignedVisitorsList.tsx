import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FiSearch, FiFile, FiFileText, FiEdit, FiFilter, FiCheck, FiArrowRight, FiUser, FiCheckCircle, FiX, FiMoreVertical, FiZap, FiClock, FiUsers, FiArrowRightCircle, FiUserCheck, FiCheckSquare, FiRefreshCw, FiMapPin, FiTrendingUp } from "react-icons/fi";
import type { AssignedVisitor } from "./sub/AssignedVisitorsHelpers";
import { statusConfig, getDisplayStatus, getOfficerName, isOfficerAccepted, isServiceCompleted, getInitials, getColorFromName } from "./sub/AssignedVisitorsHelpers";

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
        <h1 className="text-base font-bold text-gray-800">Assigned Visitors Tracking</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage real-time visitor flow and service assignments across all government departments.</p>
      </div>

      <div className="relative min-h-[calc(100vh-200px)]">
        <div className={`${showServicePanel && selectedVisitor ? 'w-[calc(100%-320px)]' : 'w-full'} space-y-4 pr-4 transition-all duration-300`}>
          <div className="bg-white border border-gray-200 p-3">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 flex gap-2 w-full">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search by visitor name, ID or badge..." className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 bg-white outline-none" />
                </div>
                <button onClick={handleSearch} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"><FiSearch className="w-3.5 h-3.5" />Search</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'accepted', 'completed', 'transferred', 'inprogress', 'waiting'] as const).map((filter) => (
                  <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-1.5 text-xs font-medium ${statusFilter === filter ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    {['VISITOR NAME', 'IDENTITY', 'BADGE NUMBER', 'DEPARTMENT', 'ASSIGNMENT TIME', 'STATUS'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-700 uppercase px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedVisitors.length > 0 ? paginatedVisitors.map((visitor) => {
                    const displayStatus = getDisplayStatus(visitor);
                    const status = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.waiting;
                    const isActive = activeVisitorId === visitor.id;
                    return (
                      <tr key={visitor.id} onClick={() => handleRowClick(visitor)} className={`cursor-pointer transition-colors ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-600 shadow-sm' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 ${getColorFromName(visitor.fullName)} flex items-center justify-center text-white text-xs font-medium`}>{getInitials(visitor.fullName)}</div>
                            <p className="text-sm font-medium text-gray-800">{visitor.fullName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><p className="text-xs text-gray-800 font-medium">{visitor.identity || '___'}</p></td>
                        <td className="px-3 py-2.5"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{visitor.badgeNumber || '___'}</span></td>
                        <td className="px-3 py-2.5"><p className="text-xs text-gray-600">{visitor.department}</p></td>
                        <td className="px-3 py-2.5"><p className="text-xs text-gray-600">{visitor.assignmentTime}</p></td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                            <span className={`w-1.5 h-1.5 ${status.dot}`}></span>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No visitors found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredVisitors.length > 0 && (
              <div className="px-3 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <p className="text-xs text-gray-600">Showing {paginatedVisitors.length} of {filteredVisitors.length} results</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                  <span className="text-xs text-gray-600 py-1 px-2">Page {currentPage} of {totalPages || 1}</span>
                  <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {showServicePanel && selectedVisitor && (
          <div className="fixed right-0 top-0 h-full z-40 shadow-2xl overflow-hidden" style={{ width: '320px' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-blue-50/60"></div>
            <div className="relative h-full flex flex-col">
              <div className="px-4 py-3 border-b border-white/30 flex items-center justify-between bg-white/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                    <FiTrendingUp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-800">Service Tracking</span>
                </div>
                <button onClick={handleClosePanel} className="p-1 hover:bg-white/50"><FiX className="w-3.5 h-3.5 text-gray-600" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="bg-white/40 p-3 shadow-lg border border-white/50">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <span className="text-xs font-bold text-white">{getInitials(selectedVisitor?.fullName || '')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{selectedVisitor?.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedVisitor?.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/50">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 ${isServiceCompleted(selectedVisitor!) ? 'bg-green-500' : isOfficerAccepted(selectedVisitor!) ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
                      <span className="text-xs font-medium text-gray-600">{isServiceCompleted(selectedVisitor!) ? 'Completed' : isOfficerAccepted(selectedVisitor!) ? 'In Progress' : 'Waiting'}</span>
                    </div>
                    <div className="text-right"><p className="text-xs text-gray-400">Checked In</p><p className="text-xs font-semibold text-gray-600">{selectedVisitor?.checkedInTime || '---'}</p></div>
                  </div>
                </div>

                <div className="bg-white/30 p-3 shadow-lg border border-white/40">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Progress</p>
                  <div className="relative">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-400 via-blue-400 to-gray-300"></div>
                    <div className="space-y-2">
                      {[{ label: 'Checked In', time: selectedVisitor?.checkedInTime || '---', sub: selectedVisitor?.checkedInGate || 'Gate', done: true, icon: FiCheck },
                        { label: 'Transferred', time: selectedVisitor?.assignmentTime || '---', sub: `To ${selectedVisitor?.department?.split(' ')[0] || 'Dept'}`, done: isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!), icon: FiArrowRightCircle },
                        { label: 'Officer Accepted', time: getOfficerName(selectedVisitor!), sub: undefined, done: isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!), icon: FiUserCheck },
                        { label: 'Completed', time: '✓ Service done', sub: undefined, done: isServiceCompleted(selectedVisitor!), icon: FiCheckSquare }].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 relative">
                          <div className={`w-6 h-6 flex items-center justify-center z-10 shadow-sm ${step.done ? 'bg-gradient-to-br from-green-400 to-green-600' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'bg-white border-2 border-blue-400' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gray-100'}`}>
                            <step.icon className={`w-3 h-3 ${step.done ? 'text-white' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'text-blue-500' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <div className={`flex-1 p-1.5 shadow-sm ${step.done ? 'bg-green-50/80' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'bg-blue-50/80' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'bg-blue-50/80' : 'bg-gray-50/50'}`}>
                            <p className={`text-xs font-semibold ${step.done ? 'text-green-700' : step.label === 'Officer Accepted' && isOfficerAccepted(selectedVisitor!) ? 'text-blue-700' : step.label === 'Transferred' && (isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!)) ? 'text-blue-700' : 'text-gray-400'}`}>{step.label}</p>
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