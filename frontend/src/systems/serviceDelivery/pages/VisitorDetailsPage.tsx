import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiRefreshCw, FiCheckCircle, FiClock, FiX, FiLoader, FiSave, FiEdit3, FiPlus, FiArrowRightCircle } from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { serviceDeliveryService, departmentService, employeeService } from '../../../core/services/adminService';
import { getTasks } from '../../../core/services/taskService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import CreateTaskModal from '../../taskManagement/components/CreateTaskModal';
import { ServeVisitorModal } from '../components/employeeFlow';
import { validateIdNumber, validateEmail, LiveTimer, TransferModal } from './sub/VisitorDetailsHelpers';

const VisitorDetailsPage: React.FC = () => {
  const { visitorId } = useParams<{ visitorId: string }>(); const navigate = useNavigate(); const { user } = useAuth(); const { showSuccess, showError } = useToast();
  const [visitor, setVisitor] = useState<any>(null); const [loading, setLoading] = useState(true); const [updating, setUpdating] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<any>(null); const [isEditMode, setIsEditMode] = useState(false);
  const [idError, setIdError] = useState<string | null>(null); const [emailError, setEmailError] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false); const [showServeModal, setShowServeModal] = useState(false);
  const [selectedVisitorForServe, setSelectedVisitorForServe] = useState<any>(null);
  const [showTransferModal, setShowTransferModal] = useState(false); const [transferring, setTransferring] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]); const [transferDepartment, setTransferDepartment] = useState("");
  const [units, setUnits] = useState<any[]>([]); const [selectedUnit, setSelectedUnit] = useState("");
  const [transferVisitor, setTransferVisitor] = useState<any>(null); const [visitorTasks, setVisitorTasks] = useState<any[]>([]);
  const [liveElapsed, setLiveElapsed] = useState(0); const liveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (field: string, value: string) => {
    const updateNested = (obj: any, path: string, val: string) => { const keys = path.split('.'); const last = keys.pop()!; const t = keys.reduce((o, k) => (o[k] = o[k] || {}), obj); t[last] = val; return { ...obj }; };
    const updated = field.includes('.') ? updateNested(editingVisitor, field, value) : { ...editingVisitor, [field]: value };
    setEditingVisitor(updated);
    if (field.includes('identification')) { const id = updated.identification; setIdError(validateIdNumber(id?.id_type || '', id?.number || '')); }
    if (field === 'email') setEmailError(validateEmail(value));
  };

  useEffect(() => {
    if (!visitorId) { showError('No visitor ID'); navigate('/service-delivery/employee'); return; }
    const load = async () => { try { setLoading(true); const r = await serviceDeliveryService.getById(visitorId); if (r.success && r.data) { setVisitor(r.data); setEditingVisitor({ ...r.data }); try { const t = await getTasks(); if (t.success) setVisitorTasks(t.data.tasks.filter((task: any) => task.belongs?.isBelongsTo && task.belongs.itBelongsTo === visitorId)); } catch (e) {} } else { showError(r.message || 'Failed'); navigate('/service-delivery/employee'); } } catch (err: any) { showError(err.message); navigate('/service-delivery/employee'); } finally { setLoading(false); } };
    load(); const fetchDeps = async () => { try { const r: any = await departmentService.getAll(); if (r && (r.data || Array.isArray(r))) setDepartments(Array.isArray(r.data) ? r.data : r); } catch (error) {} }; fetchDeps();
  }, [visitorId]);

  useEffect(() => { if (!visitor) return; const cu = user as any; const myId = String(cu?.userId || cu?._id || cu?.id || ''); const sd = visitor?.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null); const st = sd?.started_at || ''; if (!st) { if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; } setLiveElapsed(0); return; } const tick = () => setLiveElapsed(Math.floor((Date.now() - new Date(st).getTime()) / 1000)); tick(); liveTimerRef.current = setInterval(tick, 1000); return () => { if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; } }; }, [visitor, user]);

  const loadUnitsByDepartment = async (deptId: string) => { try { const r: any = await departmentService.getAll(); if (r.status || r.success) { const d = Array.isArray(r.data) ? r.data : []; setUnits(d.filter((x: any) => (x.sub_department_mng?.is_sub_department === true || x.sub_department_mng?.is_sub_department === "true") && String(x.sub_department_mng?.parent_department_id) === String(deptId)).map((s: any) => ({ id: s._id || s.department_id, name: s.department_name || s.name }))); } else setUnits([]); } catch (error) { setUnits([]); } };
  const reloadVisitor = async () => { if (!visitorId) return; try { const r = await serviceDeliveryService.getById(visitorId); if (r.success && r.data) { setVisitor(r.data); setEditingVisitor({ ...r.data }); } } catch (error) {} };

  const handleUpdateVisitor = async () => {
    if (!editingVisitor || !visitor) return;
    if (!editingVisitor.full_name || !editingVisitor.telephone) { showError('Fill required fields'); return; }
    const idErr = validateIdNumber(editingVisitor.identification?.id_type || '', editingVisitor.identification?.number || ''); if (idErr) { showError(idErr); return; }
    const emailErr = validateEmail(editingVisitor.email || ''); if (emailErr) { showError(emailErr); return; }
    setUpdating(true);
    try { const r = await serviceDeliveryService.update(visitor._id, { full_name: editingVisitor.full_name, telephone: editingVisitor.telephone, email: editingVisitor.email, gender: editingVisitor.gender, identification: editingVisitor.identification }); if (r.success) { setVisitor({ ...visitor, ...r.data }); setEditingVisitor({ ...r.data }); setIsEditMode(false); showSuccess('Updated'); } else showError(r.message || 'Failed'); }
    catch (err: any) { showError(err.message); } finally { setUpdating(false); }
  };

  const buildVisitorForServe = (raw: any) => {
    const cu = user as any; const myId = String(cu?.userId || cu?._id || cu?.id || '');
    const myAssignment = raw?.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
    const sd = raw?.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
    let mySS: any = null;
    if (Array.isArray(raw?.services_status)) mySS = raw.services_status.find((s: any) => String(s.provider_id) === myId);
    else if (raw?.services_status && typeof raw.services_status === "object" && String(raw.services_status.provider_id) === myId) mySS = raw.services_status;
    let status = (mySS?.s_type || raw?.status || "Not started");
    if (status === "transfered" || status === "transferred") status = "transfered";
    return { id: raw._id, name: raw.full_name || "Unknown", visitorName: raw.full_name || "Unknown", visitorId: typeof raw.identification === "string" ? raw.identification : raw.identification?.number || "N/A", badgeNumber: raw.badge_number || "", email: raw.telephone || "N/A", service: myAssignment?.department_name || "General Service", checkInTime: myAssignment?.assigned_time || raw.entry_date ? new Date(myAssignment?.assigned_time || raw.entry_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "N/A", gate: "Main Reception", status, serviceStartTime: sd?.started_at || "", assignedTo: myAssignment?.provider_name || myAssignment?.department_name || "Unassigned", waitTime: raw?.current_duration || "N/A", rawVisitor: raw };
  };

  const handleServeClick = async () => { if (!visitor) return; setSelectedVisitorForServe(buildVisitorForServe(visitor)); const st = visitor?.durations?.services_durations?.find((d: any) => d.ended_at === null)?.started_at; if (!st) { await serviceDeliveryService.updateServiceStatus({ visitor_id: visitor._id, status: "Inprogress", notes: "" }); await reloadVisitor(); } setShowServeModal(true); };
  const handleServiceComplete = async (data: any) => { if (!selectedVisitorForServe) return; try { const isTransfer = data.notes?.toLowerCase().includes("transfer"); await serviceDeliveryService.updateServiceStatus({ visitor_id: selectedVisitorForServe.id, status: isTransfer ? "Transfered" : "Completed", notes: data.notes }); setShowServeModal(false); setSelectedVisitorForServe(null); await reloadVisitor(); } catch (error) { alert("Failed"); } };
  const handleTransferClick = () => { if (!visitor) return; setTransferVisitor(visitor); setTransferDepartment(""); setUnits([]); setSelectedUnit(""); setShowTransferModal(true); };
  const handleTransferVisitor = async () => { if (!transferVisitor || !transferDepartment) return; setTransferring(true); try { const cu = user as any; const myId = String(cu?.userId || cu?._id || cu?.id || ''); const targetId = selectedUnit || transferDepartment; const info = selectedUnit ? units.find(u => u.id === selectedUnit) : departments.find(d => d._id === transferDepartment); await serviceDeliveryService.assignToDepartment(transferVisitor._id, targetId, info?.name || info?.department_name || "Unknown", undefined, undefined); setShowTransferModal(false); setTransferVisitor(null); await reloadVisitor(); } catch (error) { alert("Failed"); } finally { setTransferring(false); } };

  if (loading) return <MainLayout><div className="flex items-center justify-center min-h-[400px]"><FiLoader className="w-5 h-5 animate-spin text-blue-600 mx-auto mb-3" /><p className="text-sm text-gray-600">Loading...</p></div></MainLayout>;
  if (!visitor || !editingVisitor) return <MainLayout><div className="flex items-center justify-center min-h-[400px]"><FiX className="w-5 h-5 text-red-600 mx-auto mb-2" /><p className="text-sm mb-2">Not found</p><button onClick={() => navigate('/service-delivery/employee')} className="px-3 py-1.5 bg-blue-600 text-white text-sm">Back</button></div></MainLayout>;

  const cu = user as any; const myId = String(cu?.userId || cu?._id || cu?.id || '');
  const sd = visitor?.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
  const serviceStartTime = sd?.started_at || '';

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/service-delivery/employee')} className="p-1.5 hover:bg-gray-100"><FiArrowLeft className="w-4 h-4" /></button>
            <h1 className="text-sm font-semibold text-[#1a2744]">Visitor Details</h1>
            {serviceStartTime && <span className="inline-flex items-center gap-1.5 bg-blue-100 border border-blue-300 text-blue-700 px-3 py-1 text-xs font-bold"><FiClock className="w-4 h-4" />Service — <LiveTimer startTime={serviceStartTime} /></span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateTaskModal(true)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 flex items-center gap-1"><FiPlus className="w-3.5 h-3.5" />Task</button>
            <button onClick={() => setIsEditMode(!isEditMode)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1"><FiEdit3 className="w-3.5 h-3.5" />{isEditMode ? 'Cancel' : 'Edit'}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visitorTasks.length > 0 && <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border border-purple-100"><h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2"><FiCheckCircle className="w-4 h-4 text-purple-600" />Tasks ({visitorTasks.length})</h3><div className="space-y-2">{visitorTasks.map((t: any) => <div key={t._id} className="bg-white p-3 border border-purple-200"><div className="flex justify-between"><div><h4 className="text-sm font-medium">{t.title}</h4><p className="text-xs text-gray-600 mt-0.5">{t.description}</p><div className="flex items-center gap-2 mt-1"><span className={`text-xs px-2 py-0.5 font-medium ${t.status === 'Completed' ? 'bg-green-100 text-green-800' : t.status === 'In-progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span><span className="text-xs text-gray-500">Priority: {t.priority}</span></div></div></div></div>)}</div></div>}

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2"><FiUser className="w-4 h-4 text-blue-600" />Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[{ label: 'Full Name', key: 'full_name', type: 'text' }, { label: 'Telephone', key: 'telephone', type: 'text' }, { label: 'Email', key: 'email', type: 'email' }].map(f => (
                <div key={f.key}><label className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-0.5 block">{f.label}</label>
                  <input type={f.type} value={editingVisitor[f.key] || ''} onChange={e => handleInputChange(f.key, e.target.value)} disabled={!isEditMode} className={`w-full px-2.5 py-1.5 border text-sm ${isEditMode ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`} /></div>
              ))}
              <div><label className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-0.5 block">Gender</label><select value={editingVisitor.gender || 'Not Specified'} onChange={e => handleInputChange('gender', e.target.value)} disabled={!isEditMode} className={`w-full px-2.5 py-1.5 border text-sm ${isEditMode ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}><option>Male</option><option>Female</option><option>Not Specified</option></select></div>
              <div><label className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-0.5 block">Badge Number</label><input type="text" value={editingVisitor.badge_number || ''} readOnly className="w-full px-2.5 py-1.5 border border-gray-200 bg-gray-50 text-gray-700 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-0.5 block">ID Type</label><select value={editingVisitor.identification?.id_type || ''} onChange={e => handleInputChange('identification.id_type', e.target.value)} disabled={!isEditMode} className={`w-full px-2.5 py-1.5 border text-sm ${isEditMode ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}><option value="">Select</option><option value="National ID">National ID</option><option value="Passport">Passport</option><option value="Driving Licence">Driving Licence</option></select></div>
              <div><label className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-0.5 block">ID Number</label><input type="text" value={editingVisitor.identification?.number || ''} onChange={e => handleInputChange('identification.number', e.target.value)} disabled={!isEditMode} className={`w-full px-2.5 py-1.5 border text-sm ${isEditMode ? (idError ? 'border-red-500' : 'border-gray-300') : 'border-gray-200 bg-gray-50 text-gray-700'}`} />{isEditMode && idError && <p className="text-xs text-red-500 mt-0.5">{idError}</p>}</div>
            </div>
            {isEditMode && <div className="mt-3 flex justify-end"><button onClick={handleUpdateVisitor} disabled={updating} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">{updating ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiSave className="w-3.5 h-3.5" />}Save</button></div>}
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 border border-purple-100">
            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2"><FiCheckCircle className="w-4 h-4 text-purple-600" />Department Assignments</h3>
            <div className="space-y-2">{editingVisitor.departments_assigned?.map((d: any, i: number) => <div key={i} className="bg-white p-3 border border-purple-200"><div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs"><div><span className="font-medium text-gray-600 uppercase">Department</span><p className="text-sm font-medium text-gray-900">{d.department_name}</p></div><div><span className="font-medium text-gray-600 uppercase">Time</span><p className="text-sm">{new Date(d.assigned_time).toLocaleString()}</p></div><div><span className="font-medium text-gray-600 uppercase">Provider</span><p className="text-sm">{d.provider_name || 'N/A'}</p></div><div><span className="font-medium text-gray-600 uppercase">Reached</span><span className={`text-xs px-2 py-0.5 font-medium ${d.reached_in ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{d.reached_in ? 'Yes' : 'No'}</span></div></div></div>)}</div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 border border-green-100">
            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2"><FiRefreshCw className="w-4 h-4 text-green-600" />Service Status</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleServeClick} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Serve / View Service</button>
              <button onClick={handleTransferClick} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center gap-1.5"><FiArrowRightCircle className="w-4 h-4" />Transfer</button>
            </div>
          </div>
        </div>
      </div>

      {showCreateTaskModal && <CreateTaskModal {...{ isOpen: showCreateTaskModal, onClose: () => setShowCreateTaskModal(false), visitorId: visitorId || '' } as any} />}
      {showServeModal && selectedVisitorForServe && <ServeVisitorModal {...{ visitor: selectedVisitorForServe, onClose: () => { setShowServeModal(false); setSelectedVisitorForServe(null); }, onComplete: handleServiceComplete } as any} />}
      <TransferModal show={showTransferModal} onClose={() => setShowTransferModal(false)} departments={departments} units={units} transferDepartment={transferDepartment} selectedUnit={selectedUnit} transferring={transferring} onDepartmentChange={(id) => { setTransferDepartment(id); setSelectedUnit(""); if (id) loadUnitsByDepartment(id); else setUnits([]); }} onUnitChange={setSelectedUnit} onTransfer={handleTransferVisitor} />
    </MainLayout>
  );
};

export default VisitorDetailsPage;