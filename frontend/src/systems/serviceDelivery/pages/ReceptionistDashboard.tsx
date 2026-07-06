import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSearch, FiUsers, FiClock, FiCheckCircle, FiMoreVertical, FiGrid } from "react-icons/fi";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { serviceDeliveryService, departmentService, statisticsService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";
import AssignedVisitorsList from "../components/departmentFlow/AssignedVisitorsList";
import AssignVisitorModal from "../components/departmentFlow/AssignVisitorModal";
import Table from "../../../core/components/Table";
import { SkeletonCard, SkeletonTableRow } from "./sub/ReceptionistSkeleton";

interface Visitor { _id?: string; id?: string; name?: string; full_name?: string; visitorName?: string; badge_number?: string; badge?: string; identification?: string | { number?: string }; telephone?: string; email?: string; status: string; checkInTime?: string; check_in_time?: string; entry_date?: string; department?: string; departmentName?: string; departments_assigned?: Array<{ department_id: string; department_name?: string; status: string; provider_name?: string; provider_id?: string }>; services_status?: Array<{ department_id: string; department_name?: string; s_type?: string; provider_name?: string; provider_id?: string }>; }

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate(); const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth(); const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"dashboard" | "visitors">(tabParam === "visitors" ? "visitors" : "dashboard");
  const [searchTerm, setSearchTerm] = useState(""); const [searchLoading, setSearchLoading] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [unassignedVisitors, setUnassignedVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subDepartmentIds, setSubDepartmentIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true); const [firstLoad, setFirstLoad] = useState(true);
  const [hourlyData, setHourlyData] = useState<{ hour: number; visitors_checked_in: number }[]>([]);
  const [hourlyDataLoading, setHourlyDataLoading] = useState(true);
  const [departmentVisitorCounts, setDepartmentVisitorCounts] = useState<Record<string, number>>({});
  const [units, setUnits] = useState<any[]>([]); const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(""); const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false); const [successMessage, setSuccessMessage] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { const t = searchParams.get("tab"); if (t === "visitors") setActiveTab("visitors"); else setActiveTab("dashboard"); }, [searchParams]);
  useEffect(() => { if (!authLoading && !isAuthenticated) navigate("/login"); }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setIsLoading(true); if (searchTerm?.trim()) setSearchLoading(true);
    try {
      let visitorRes = searchTerm?.trim() ? await serviceDeliveryService.search(searchTerm, currentPage, 50) : await serviceDeliveryService.getAll(currentPage, 50);
      if (visitorRes.status || visitorRes.success) {
        const allVisitors = Array.isArray(visitorRes.data) ? visitorRes.data : [];
        allVisitors.sort((a: any, b: any) => (new Date(a.checkInTime || a.check_in_time || a.entry_date).getTime()) - (new Date(b.checkInTime || b.check_in_time || b.entry_date).getTime()));
        setVisitors(allVisitors); setTotalCount(visitorRes.total || 0);
        setUnassignedVisitors(allVisitors.filter((v: any) => !v.departments_assigned || !Array.isArray(v.departments_assigned) || v.departments_assigned.length === 0));
        const counts: Record<string, number> = {};
        allVisitors.forEach((v: any) => { if (v.departments_assigned) v.departments_assigned.forEach((d: any) => { const n = d.department_name || d.department || "Unknown"; counts[n] = (counts[n] || 0) + 1; }); });
        setDepartmentVisitorCounts(counts);
      }
      const deptR = await departmentService.getAll();
      if (deptR.status || deptR.success) {
        const deptData = Array.isArray(deptR.data) ? deptR.data : [];
        setDepartments(deptData);
        const ids = new Set<string>();
        deptData.forEach((d: any) => { if (d.sub_department_mng?.is_sub_department === true || d.sub_department_mng?.is_sub_department === "true") ids.add(String(d._id || d.department_id)); if (d.sub_departments) d.sub_departments.forEach((s: any) => { const id = s._id || s.department_id; if (id) ids.add(String(id)); }); });
        setSubDepartmentIds(ids);
      }
      setHourlyDataLoading(true);
      try { const hR = await statisticsService.getHourlyServiceDeliveryStats(); if (hR.success) setHourlyData(hR.data?.hourly || hR.data || []); } catch (error) { }
    } catch (error) { } finally { setFirstLoad(false); setIsLoading(false); setSearchLoading(false); setHourlyDataLoading(false); }
  };

  useEffect(() => { loadData(); }, [currentPage, searchTerm]);
  useEffect(() => { if (!socket || !isConnected) return; const h = (data: any) => { if (data.show_notif === false) { const m = data.message; const t = data.type || "info"; if (t === "success") showSuccess(m); else if (t === "error") showError(m); else if (t === "warning") showWarning(m); else showInfo(m); } loadData(); }; socket.on("visitor_checkedin", h); socket.on("visitor_checkedout", h); socket.on("car_checkedin", h); socket.on("car_checkedout", h); return () => { socket.off("visitor_checkedin", h); socket.off("visitor_checkedout", h); socket.off("car_checkedin", h); socket.off("car_checkedout", h); }; }, [socket, isConnected]);

  const formattedDepartments = departments.filter(d => !d.sub_department_mng?.is_sub_department).map(d => ({ id: d._id || d.department_id, name: d.department_name || d.name, staffAvailable: d.total_employees || 0, currentQueue: departmentVisitorCounts[d.department_name || d.name] || 0, isActive: d.status !== "Inactive" }));
  const getVisitorName = (v: Visitor) => v.full_name || v.name || v.visitorName || "Unknown";
  const getCheckInTime = (v: Visitor) => new Date(v.checkInTime || v.check_in_time || v.entry_date || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Just now";
  const getIdentification = (v: Visitor) => !v.identification ? "---" : typeof v.identification === "string" ? v.identification : v.identification.number || "---";
  const paginatedVisitors = unassignedVisitors;
  const totalVisitors = visitors.length;
  const assignedCount = visitors.filter(v => v.departments_assigned && v.departments_assigned.length > 0).length;
  const totalDepartments = departments.length;

  const loadUnitsByDepartment = async (deptId: string) => {
    setUnitsLoading(true);
    try { const r = await departmentService.getAll(); if (r.status || r.success) { const d = Array.isArray(r.data) ? r.data : []; setUnits(d.filter((x: any) => (x.sub_department_mng?.is_sub_department === true || x.sub_department_mng?.is_sub_department === "true") && String(x.sub_department_mng?.parent_department_id) === String(deptId)).map((s: any) => ({ id: s._id || s.department_id, name: s.department_name || s.name, staffAvailable: s.total_employees || 0, currentQueue: departmentVisitorCounts[s.department_name || s.name] || 0, isActive: true }))); } else setUnits([]); }
    catch (error) { setUnits([]); } finally { setUnitsLoading(false); }
  };

  const handleAssignClick = (v: Visitor) => { setSelectedVisitor(v); setShowAssignModal(true); };
  const handleCloseModal = () => { setShowAssignModal(false); setSelectedVisitor(null); setSelectedDepartment(""); setSelectedUnit(""); setUnits([]); };
  const handleConfirmAssignment = async () => {
    if (selectedVisitor && selectedDepartment) { setIsAssigning(true);
      try { const visitorId = selectedVisitor._id || selectedVisitor.id; const targetId = selectedUnit || selectedDepartment; const info = selectedUnit ? units.find(u => u.id === selectedUnit) : formattedDepartments.find(d => d.id === selectedDepartment); await serviceDeliveryService.assignToDepartment(visitorId as string, targetId, info?.name || "", undefined, undefined); handleCloseModal(); showSuccess(`Assigned to ${info?.name}`); loadData(); }
      catch (error: any) { showWarning(error?.message || "Failed"); } finally { setIsAssigning(false); } }
  };

  return (
    <div className="space-y-4">
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {firstLoad ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              : [{ label: "Total Current Visitors", value: totalCount, icon: FiUsers, color: "text-blue-700" }, { label: "Total Departments", value: totalDepartments, icon: FiGrid, color: "text-emerald-700" }, { label: "Total Assigned", value: assignedCount, icon: FiCheckCircle, color: "text-teal-700" }].map((s, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div><p className="text-xs font-medium mb-0.5" style={{ color: s.color }}>{s.label}</p><h3 className="text-xl font-bold" style={{ color: s.color }}>{s.value}</h3></div>
                      <div className="p-2 bg-gray-50"><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                    </div>
                  </div>
                ))}
          </div>

          <div className="bg-white border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3"><div className="p-1.5 bg-gray-50"><FiClock className="w-4 h-4 text-blue-600" /></div><div><h3 className="text-sm font-semibold text-gray-800">Daily Insights</h3><p className="text-xs text-gray-500">Visitor traffic by hour</p></div></div>
            {hourlyDataLoading && firstLoad ? <div className="h-48 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent"></div></div>
              : hourlyData.length > 0 ? <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="visitors_checked_in" stroke="#00aaff" fill="rgba(0,170,255,0.1)" /></AreaChart></ResponsiveContainer></div>
                : <div className="h-48 flex items-center justify-center text-xs text-gray-400">No data</div>}
          </div>

          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wide">Search Visitors</h2>
              <div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input type="text" placeholder="Search Badge, Name, Phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-1.5 w-48 border border-gray-200 text-xs" /></div>
            </div>
            <Table headers={[{ key: 'badge_number', label: 'BADGE' }, { key: 'full_name', label: 'NAME' }, { key: 'identification', label: 'ID' }, { key: 'status', label: 'STATUS' }, { key: 'time', label: 'TIME' }, { key: 'telephone', label: 'PHONE' }, { key: 'actions', label: 'ACTIONS' }]} data={paginatedVisitors} loading={isLoading && firstLoad} emptyMessage="No visitors."
              renderCell={(header, v: any) => {
                switch (header.key) {
                  case 'badge_number': return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">{v.badge_number || v.badge || "---"}</span>;
                  case 'full_name': return <div className="flex items-center gap-2"><div className="w-7 h-7 bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{getVisitorName(v).substring(0, 2).toUpperCase()}</div><span className="text-sm font-semibold text-gray-800">{getVisitorName(v)}</span></div>;
                  case 'identification': return <span className="text-xs text-gray-600">{getIdentification(v)}</span>;
                  case 'status': return <span className={`text-xs px-2 py-0.5 font-bold uppercase ${v.status === "In_progress" || v.status === "Inside" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>{v.status || "Pending"}</span>;
                  case 'time': return <span className="text-xs font-semibold text-gray-800">{getCheckInTime(v)}</span>;
                  case 'telephone': return <span className="text-xs text-gray-600">{v.telephone || "---"}</span>;
                  case 'actions': return v.status === "In_progress" || v.status === "Inside" ? <button className="p-1.5 text-gray-400 cursor-not-allowed"><FiMoreVertical className="w-3.5 h-3.5" /></button> : <button onClick={() => handleAssignClick(v)} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold">Assign</button>;
                  default: return <span className="text-xs">{v[header.key] || '-'}</span>;
                }
              }}
              pagination={{ currentPage, totalPages: Math.ceil(totalCount / 50), totalCount, itemsPerPage: 50, onPageChange: (p) => setCurrentPage(p), loading: isLoading }}
            />
          </div>
        </div>
      )}

      {activeTab === "visitors" && (
        <AssignedVisitorsList visitors={visitors.filter(v => v.departments_assigned && v.departments_assigned.length > 0).map(v => {
          const deptId = v.departments_assigned?.[0]?.department_id;
          const ss = v.services_status?.find((s: any) => s.department_id === deptId);
          const isSub = deptId ? subDepartmentIds.has(deptId) : false;
          let dn = v.departments_assigned?.[0]?.department_name || v.department || "General";
          let un = "";
          if (isSub) { un = dn; const p = departments.find(d => d.sub_departments?.some((s: any) => (s._id || s.department_id) === deptId)); dn = p?.department_name || p?.name || "Unknown"; }
          return { id: String(v._id || v.id || ""), fullName: getVisitorName(v), nationalId: getIdentification(v), identity: getIdentification(v), badgeNumber: v.badge_number || v.badge || "---", service: "General Inquiry", department: dn, unit: un, assignmentTime: getCheckInTime(v), status: String(v.status || "pending"), phone: String(v.telephone || ""), checkInTime: getCheckInTime(v), roomNumber: "Pending", queuePosition: 0, checkedInTime: getCheckInTime(v), checkedInGate: "Main Gate", receptionistName: "", officerName: "Pending", providerName: ss?.provider_name || v.departments_assigned?.[0]?.provider_name || "", providerId: ss?.provider_id || v.departments_assigned?.[0]?.provider_id || "", serviceType: ss?.s_type || v.services_status?.[0]?.s_type || "Not started", currentDepartmentId: deptId };
        })} />
      )}

      <AssignVisitorModal isOpen={showAssignModal} onClose={handleCloseModal} visitor={selectedVisitor as any} departments={formattedDepartments} units={units} selectedDepartment={selectedDepartment} selectedUnit={selectedUnit}
        onSelectDepartment={(id) => { setSelectedDepartment(id); setSelectedUnit(""); if (id) loadUnitsByDepartment(id); else setUnits([]); }} onSelectUnit={setSelectedUnit} onConfirm={handleConfirmAssignment}
        showSuccessMessage={showSuccessMessage} successMessage={successMessage} isLoading={isAssigning} unitsLoading={unitsLoading} />
    </div>
  );
};

export default ReceptionistDashboard;