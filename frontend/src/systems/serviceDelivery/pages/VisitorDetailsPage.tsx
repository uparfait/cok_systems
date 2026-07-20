
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiUser, FiRefreshCw, FiCheckCircle, FiClock, FiX, FiLoader, FiSave, FiEdit3, FiPlus,
  FiSquare, FiArrowRightCircle, FiSearch
} from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  serviceDeliveryService,
  departmentService,
  employeeService,
} from '../../../core/services/adminService';
import { getTasks } from '../../../core/services/taskService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import CreateTaskModal from '../../taskManagement/components/CreateTaskModal';
import { ServeVisitorModal } from '../components/employeeFlow';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

// ======== Additional Interfaces ========

interface TransferEmployee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  title?: string;
}

interface UnitOption {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
}

// Validation helper functions (from CheckInPersonPage)
const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === '') {
    return null; // Optional field - no validation needed
  }

  const trimmedId = idNumber.trim();

  if (idType === 'National ID') {
    // National ID must be 16 characters
    if (trimmedId.length !== 16) {
      return 'National ID must be 16 digits';
    }
    // National ID should only contain numbers (Egyptian national ID format)
    if (!/^\d+$/.test(trimmedId)) {
      return 'National ID must contain only numbers';
    }
  } else if (idType === 'Passport') {
    // Passport typically 6-9 characters with letters and numbers
    if (trimmedId.length < 6) {
      return 'Passport number must be at least 6 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Passport number must contain only letters and numbers';
    }
  } else if (idType === 'Driving Licence') {
    // Driving licence typically 8-15 characters
    if (trimmedId.length < 8) {
      return 'Driving Licence must be at least 8 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Driving Licence must contain only letters and numbers';
    }
  }

  return null; // Valid
};

// Email validation helper
const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return null; // Optional field - no validation needed
  }

  const trimmedEmail = email.trim();
  // General email regex - accepts any valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }

  return null; // Valid
};

const VisitorDetailsPage: React.FC = () => {
  const { visitorId } = useParams<{ visitorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Handle input changes with validation
  const handleInputChange = (field: string, value: string) => {
    const updateNestedObject = (obj: any, path: string, val: string) => {
      const keys = path.split('.');
      const lastKey = keys.pop()!;
      const target = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
      target[lastKey] = val;
      return { ...obj };
    };

    const updatedVisitor = field.includes('.')
      ? updateNestedObject(editingVisitor, field, value)
      : { ...editingVisitor, [field]: value };

    setEditingVisitor(updatedVisitor);

    // Validate ID number when id_type or id_number changes
    if (field === 'identification.id_type' || field === 'identification.number') {
      const currentIdentification = field.includes('.')
        ? updateNestedObject(editingVisitor, field, value).identification
        : editingVisitor.identification;
      const newIdType = currentIdentification?.id_type || '';
      const newIdNumber = currentIdentification?.number || '';
      const error = validateIdNumber(newIdType, newIdNumber);
      setIdError(error);
    }

    // Validate email when email changes
    if (field === 'email') {
      const error = validateEmail(value);
      setEmailError(error);
    }
  };

  const [visitor, setVisitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  // Service State
  const [isServing, setIsServing] = useState(false);

  // Serve Modal State
  const [showServeModal, setShowServeModal] = useState(false);
  const [selectedVisitorForServe, setSelectedVisitorForServe] = useState<any>(null);

  // Live Timer state for inline display
  const [liveElapsed, setLiveElapsed] = useState(0);
  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Tick liveElapsed every second when an active service exists ─────
  useEffect(() => {
    if (!visitor) return;
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || '');
    const serviceDuration = visitor?.durations?.services_durations?.find(
      (d: any) => String(d.provider_id) === myId && d.ended_at === null,
    );
    const startTime = serviceDuration?.started_at || "";

    if (!startTime) {
      if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; }
      setLiveElapsed(0);
      return;
    }

    const tick = () => setLiveElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    tick();
    liveTimerRef.current = setInterval(tick, 1000);
    return () => { if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; } };
  }, [visitor, user]);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDepartment, setTransferDepartment] = useState<string>("");
  const [transferEmployee, setTransferEmployee] = useState<TransferEmployee | null>(null);
  const [transferring, setTransferring] = useState(false);
  // Transfer Modal helper state
  const [departments, setDepartments] = useState<any[]>([]);
  const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [transferVisitor, setTransferVisitor] = useState<any>(null);

  const [visitorTasks, setVisitorTasks] = useState<any[]>([]);

  // Load visitor data
  useEffect(() => {
    const loadVisitor = async () => {
      if (!visitorId) {
        showError('Visitor ID not provided');
        navigate('/service-delivery/employee');
        return;
      }

      try {
        setLoading(true);
        const response = await serviceDeliveryService.getById(visitorId);

        if (response.success && response.data) {
          setVisitor(response.data);
          setEditingVisitor({ ...response.data });

          // Fetch tasks that belong to this visitor
          try {
            const tasksResponse = await getTasks();
            if (tasksResponse.success) {
              const tasks = tasksResponse.data.tasks.filter((task: any) =>
                task.belongs?.isBelongsTo && task.belongs.itBelongsTo === visitorId
              );
              setVisitorTasks(tasks);
            }
          } catch (error) {
            console.error('Error fetching visitor tasks:', error);
          }
        } else {
          showError(response.message || 'Failed to load visitor details');
          navigate('/service-delivery/employee');
        }
      } catch (error: any) {
        console.error('Error loading visitor:', error);
        showError(error.message || 'Failed to load visitor details');
        navigate('/service-delivery/employee');
      } finally {
        setLoading(false);
      }
    };

    loadVisitor();
  }, [visitorId, navigate, showError]);

  // Load departments (needed for transfer modal, only once on mount)
  useEffect(() => {
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateVisitor = async () => {
    if (!editingVisitor || !visitor) return;

    // Validate required fields
    if (!editingVisitor.full_name || !editingVisitor.telephone) {
      showError('Please fill in required fields (Full Name and Telephone)');
      return;
    }

    // Validate ID number
    const idValidationError = validateIdNumber(
      editingVisitor.identification?.id_type || '',
      editingVisitor.identification?.number || ''
    );
    if (idValidationError) {
      showError(idValidationError);
      return;
    }

    // Validate email if provided
    const emailValidationError = validateEmail(editingVisitor.email || '');
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    setUpdating(true);
    try {
      const updateData = {
        full_name: editingVisitor.full_name,
        telephone: editingVisitor.telephone,
        email: editingVisitor.email,
        gender: editingVisitor.gender,
        identification: editingVisitor.identification
      };

      const response = await serviceDeliveryService.update(visitor._id, updateData);

      if (response.success) {
        setVisitor({ ...visitor, ...response.data });
        setEditingVisitor({ ...response.data });
        setIsEditMode(false);
        showSuccess('Visitor information updated successfully');
      } else {
        showError(response.message || 'Failed to update visitor');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      showError(error.message || 'Failed to update visitor');
    } finally {
      setUpdating(false);
    }
  };

  const handleBack = () => {
    navigate('/service-delivery/employee');
  };

  // ============================================================
  //  Live Inline Timer (mirrors ProvideServicesTab LiveTimer)
  // ============================================================
  const LiveTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
      if (!startTime) return;
      const start = new Date(startTime).getTime();

      const updateTime = () =>
        setElapsed(
          Math.max(0, Math.floor((new Date().getTime() - start) / 1000)),
        );

      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }, [startTime]);

    const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");

    return (
      <span className="font-mono tracking-widest">
        {h}:{m}:{s}
      </span>
    );
  };

  // ============================================================
  //  Helper: Build visitor service object from raw visitor data
  // ============================================================
  const buildVisitorForServe = (raw: any) => {
    const currentUser = user as any;
    const myId = String(
      currentUser?.userId || currentUser?._id || currentUser?.id || '',
    );

    const myAssignment = raw?.departments_assigned?.find(
      (d: any) => String(d.provider_id) === myId,
    );

    const serviceDuration = raw?.durations?.services_durations?.find(
      (d: any) => String(d.provider_id) === myId && d.ended_at === null,
    );
    const serviceStartTimeVal = serviceDuration?.started_at || "";

    let myServiceStatus: any = null;
    if (Array.isArray(raw?.services_status)) {
      myServiceStatus = raw.services_status.find(
        (s: any) => String(s.provider_id) === myId,
      );
    } else if (raw?.services_status && typeof raw.services_status === "object") {
      if (String(raw.services_status.provider_id) === myId) {
        myServiceStatus = raw.services_status;
      }
    }

    let status = (myServiceStatus?.s_type || raw?.status || "Not started");
    if (status === "transfered" || status === "transferred") status = "transfered";

    return {
      id: raw._id,
      name: raw.full_name || "Unknown",          // ← ServeVisitorModal reads .name
      visitorName: raw.full_name || "Unknown",
      visitorId:
        typeof raw.identification === "string"
          ? raw.identification
          : raw.identification?.number || "N/A",
      badgeNumber: raw.badge_number || "",
      email: raw.telephone || "N/A",
      service: myAssignment?.department_name || raw._departmentGroup || "General Service",
      checkInTime: myAssignment?.assigned_time || raw.entry_date
        ? new Date(
            myAssignment?.assigned_time || raw.entry_date,
          ).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : "N/A",
      gate: "Main Reception",
      status,
      serviceStartTime: serviceStartTimeVal,
      assignedTo: myAssignment?.provider_name || myAssignment?.department_name || "Unassigned",
      waitTime: raw?.current_duration || "N/A",
      rawVisitor: raw,
    };
  };

  // ============================================================
  //  Backend API calls
  //  Uses POST /servicedelivery/visitor/service/status → toggle_service_status (WORKING)
  // ============================================================
  const updateBackendStatus = async (
    targetStatus: string,
    visitorId: string,
    rawVisitor: any,
    isStart: boolean = false,
    durationStr: string = "",
    notes: string = "",
  ) => {
    await serviceDeliveryService.updateServiceStatus({
      visitor_id: visitorId,
      status: targetStatus,
      notes: notes,
    });
  };

  // ============================================================
  //  Timer helper — computes elapsed HH:MM:SS from elapsed seconds
  //  If fromElapsed is given, use it; otherwise derive from startTime
  // ============================================================
  const getElapsedParts = (startTime: string, fromElapsed?: number) => {
    const elapsed = fromElapsed !== undefined ? fromElapsed : Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    return { h, m, s };
  };

  // ============================================================
  //  Serve / Stop Service
  // ============================================================
  const handleServeClick = async () => {
    if (!visitor) return;
    const raw = visitor;
    setSelectedVisitorForServe(buildVisitorForServe(raw));

    // If already started, just open the modal to show the timer + End button
    let serviceStartTime = raw?.durations?.services_durations?.find(
      (d: any) => d.ended_at === null
    )?.started_at;

    if (!serviceStartTime) {
      // First serve → set status to in-progress on backend
      await updateBackendStatus(
        "Inprogress",
        raw._id,
        raw,
        true,
      );
      setIsServing(true);
      setIsServing(false);
      await reloadVisitor();
    }
    setShowServeModal(true);
  };

  const handleServiceComplete = async (data: any) => {
    if (!selectedVisitorForServe) return;
    setIsServing(true);

    try {
      const isTransfer =
        data.notes && data.notes.toLowerCase().includes("transfer");
      const targetStatus = isTransfer ? "Transfered" : "Completed";

      await updateBackendStatus(
        targetStatus,
        selectedVisitorForServe.id,
        selectedVisitorForServe.rawVisitor,
        false,
        data.duration,
        data.notes,
      );

      setShowServeModal(false);
      setSelectedVisitorForServe(null);
      await reloadVisitor();
    } catch (error) {
      console.error("Failed to process service:", error);
      alert("Failed to process request. Please try again.");
    } finally {
      setIsServing(false);
    }
  };

  // ============================================================
  //  Transfer
  // ============================================================
  const handleTransferClick = () => {
    if (!visitor) return;
    setTransferVisitor(visitor);
    setTransferDepartment("");
    setTransferEmployee(null);
    setTransferEmployees([]);
    setUnits([]);
    setSelectedUnit("");
    setShowTransferModal(true);
  };

  const handleTransferVisitor = async () => {
    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);

    try {
      const currentUser = user as any;
      const myId = String(
        currentUser?.userId || currentUser?._id || currentUser?.id || '',
      );

      const targetId = selectedUnit || transferDepartment;
      const targetInfo = selectedUnit
        ? units.find((u) => u.id === selectedUnit)
        : departments.find((d) => d._id === transferDepartment);
      const targetName = targetInfo?.name || targetInfo?.department_name || "Unknown";

      const currentDept = transferVisitor.departments_assigned?.find(
        (d: any) => String(d.provider_id) === myId,
      );
      const previousDepartmentId = currentDept?.department_id;

      await serviceDeliveryService.assignToDepartment(
        transferVisitor._id,
        targetId,
        targetName,
        undefined, // no specific employee via department details page
        undefined,
        previousDepartmentId,
      );

      setShowTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment("");
      setTransferEmployee(null);
      setTransferEmployees([]);
      setUnits([]);
      setSelectedUnit("");

      await reloadVisitor();
    } catch (error) {
      console.error("Error transferring visitor:", error);
      alert("Failed to transfer visitor. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  const handleTransferDepartmentChange = (deptId: string) => {
    setTransferDepartment(deptId);
    setSelectedUnit("");
    if (deptId) {
      loadUnitsByDepartment(deptId);
      fetchTransferEmployees(deptId);
    } else {
      setUnits([]);
      setTransferEmployees([]);
    }
  };

  const fetchTransferEmployees = async (deptId: string) => {
    if (!deptId) {
      setTransferEmployees([]);
      return;
    }
    setTransferEmployeesLoading(true);
    try {
      const response: any = await employeeService.getByDepartment(deptId, false);
      if (response?.data || Array.isArray(response)) {
        setTransferEmployees(
          Array.isArray(response.data) ? response.data : response,
        );
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setTransferEmployees([]);
    } finally {
      setTransferEmployeesLoading(false);
    }
  };

  const loadUnitsByDepartment = async (departmentId: string) => {
    setTransferEmployeesLoading(true);
    try {
      const response: any = await departmentService.getAll();
      if (response.status || response.success) {
        const deptData = Array.isArray(response.data) ? response.data : [];
        const subDepts = deptData.filter((dept: any) => {
          return (
            (dept.sub_department_mng?.is_sub_department === true ||
              dept.sub_department_mng?.is_sub_department === "true") &&
            String(dept.sub_department_mng?.parent_department_id) ===
              String(departmentId)
          );
        });
        const formattedUnits = subDepts.map((subDept: any) => ({
          id: subDept._id || subDept.department_id,
          name: subDept.department_name || subDept.name,
          staffAvailable: subDept.total_employees || 0,
          currentQueue: 0,
          isActive: true,
        }));
        setUnits(formattedUnits);
      } else {
        setUnits([]);
      }
    } catch (error) {
      console.error("Failed to load units:", error);
      setUnits([]);
    } finally {
      setTransferEmployeesLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response: any = await departmentService.getAll();
      if (response && (response.data || Array.isArray(response))) {
        setDepartments(Array.isArray(response.data) ? response.data : response);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  // ============================================================
  //  Reload visitor (re-fetch from backend)
  // ============================================================
  const reloadVisitor = async () => {
    if (!visitorId) return;
    try {
      const response = await serviceDeliveryService.getById(visitorId);
      if (response.success && response.data) {
        setVisitor(response.data);
        setEditingVisitor({ ...response.data });
      }
    } catch (error) {
      console.error("Error reloading visitor:", error);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FiLoader className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: PRIMARY }} />
              <p style={{ color: '#555555' }}>Loading visitor details...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!visitor || !editingVisitor) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FiX className="w-8 h-8 mx-auto mb-4" style={{ color: DANGER }} />
              <p className="mb-4" style={{ color: '#555555' }}>Visitor not found</p>
              <button
                onClick={handleBack}
                className="px-4 py-2 uppercase transition-colors"
                style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                Back to Employee Dashboard
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 transition-colors"
              title="Back to Employee Dashboard"
              style={{ borderRadius: 0, color: NEUTRAL_DARK }}
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
              <h1 className="text-lg" style={{ fontFamily: fontHeading, fontWeight: 700, color: PRIMARY }}>Visitor Details</h1>


              {/* Header — In-Progress live counter pill */}
              {(() => {
                if (!visitor) return null;
                const currentUser = user as any;
                const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || '');
                const serviceDuration = visitor?.durations?.services_durations?.find(
                  (d: any) => String(d.provider_id) === myId && d.ended_at === null,
                );
                const serviceStartTimeVal = serviceDuration?.started_at || "";
                if (!serviceStartTimeVal) return null;
                const { h, m, s } = getElapsedParts(serviceStartTimeVal, liveElapsed);
                return (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-bold tracking-wide" style={{ backgroundColor: 'rgba(76,175,80,0.12)', border: `1px solid ${SUCCESS}`, color: SUCCESS, borderRadius: 0 }}>
                    <FiClock className="w-5 h-5 animate-pulse" style={{ color: SUCCESS }} /> Service In Progress — {h}:{m}:{s}
                  </span>
                );
              })()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="px-4 py-2 uppercase transition-colors flex items-center gap-2"
                style={{ backgroundColor: SUCCESS, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
              >
                <FiPlus className="w-4 h-4" />
                Create Task
              </button>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="px-4 py-2 uppercase transition-colors flex items-center gap-2"
                style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                <FiEdit3 className="w-4 h-4" />
                {isEditMode ? 'Cancel' : 'Edit'}
              </button>
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Belongs To Tasks Section */}
          {visitorTasks.length > 0 && (
            <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
              <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
                <FiCheckCircle className="w-5 h-5" style={{ color: ACCENT_DARK_BLUE }} />
                Related Tasks ({visitorTasks.length})
              </h3>
              <div className="space-y-3">
                {visitorTasks.map((task: any) => (
                  <div key={task._id} className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium" style={{ color: NEUTRAL_DARK }}>{task.title}</h4>
                        <p className="text-sm mt-1" style={{ color: '#555555' }}>{task.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex px-2 py-1 text-xs font-medium" style={{
                            backgroundColor: task.status === 'Completed' ? 'rgba(158,158,158,0.15)' :
                              task.status === 'In-progress' ? 'rgba(5,109,170,0.1)' :
                              'rgba(243,156,18,0.12)',
                            color: task.status === 'Completed' ? '#555555' :
                              task.status === 'In-progress' ? PRIMARY :
                              WARNING,
                          }}>
                            {task.status}
                          </span>
                          <span className="text-xs" style={{ color: GRAY_DISABLED }}>
                            Priority: {task.priority}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs" style={{ color: GRAY_DISABLED }}>
                        {task.dueDate && `Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information Section */}
          <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
              <FiUser className="w-5 h-5" style={{ color: PRIMARY }} />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Full Name */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Full Name
                </label>
                  <input
                    type="text"
                    value={editingVisitor.full_name || ''}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 text-sm ${
                      isEditMode
                        ? ''
                        : 'cursor-not-allowed'
                    }`}
                    style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  />
              </div>

              {/* Telephone */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Telephone
                </label>
                  <input
                    type="text"
                    value={editingVisitor.telephone || ''}
                    onChange={(e) => handleInputChange('telephone', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 text-sm ${
                      isEditMode
                        ? ''
                        : 'cursor-not-allowed'
                    }`}
                    style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  />
              </div>

              {/* Email */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Email
                </label>
                  <input
                    type="email"
                    value={editingVisitor.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 text-sm ${
                      isEditMode
                        ? emailError
                          ? ''
                          : ''
                        : 'cursor-not-allowed'
                    }`}
                    style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${isEditMode && emailError ? DANGER : 'transparent'}`, borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = isEditMode && emailError ? DANGER : PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isEditMode && emailError ? DANGER : 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  />
                  {isEditMode && emailError && (
                    <p className="mt-1 text-xs" style={{ color: DANGER }}>{emailError}</p>
                  )}
              </div>

              {/* Gender */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Gender
                </label>
                    <select
                      value={editingVisitor.gender || 'Not Specified'}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={!isEditMode}
                      className={`w-full px-3 py-2 text-sm ${
                        isEditMode
                          ? ''
                          : 'cursor-not-allowed'
                      }`}
                      style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                    >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Not Specified">Not Specified</option>
                </select>
              </div>

              {/* Badge Number */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Badge Number
                </label>
                <input
                  type="text"
                  value={editingVisitor.badge_number || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm cursor-not-allowed" style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: '#555555' }}
                />
              </div>

              {/* ID Type */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  ID Type
                </label>
                <select
                  value={editingVisitor.identification?.id_type || ''}
                  onChange={(e) => handleInputChange('identification.id_type', e.target.value)}
                  disabled={!isEditMode}
                  className={`w-full px-3 py-2 text-sm ${
                    isEditMode
                      ? ''
                      : 'cursor-not-allowed'
                  }`}
                  style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                >
                  <option value="">Select ID Type</option>
                  <option value="National ID">National ID</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving Licence">Driving Licence</option>
                </select>
              </div>

              {/* ID Number */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  {
                     editingVisitor.identification?.id_type === 'National ID' ? (
                      "National ID Number"
                    ) : editingVisitor.identification?.id_type === 'Passport' ? (
                      "Passport Number"
                    ) : editingVisitor.identification?.id_type === 'Driving Licence' ? (
                      "Driving Licence Number"
                    ) : (
                      "ID Number"
                    )
                  }
                </label>
                  <input
                    type="text"
                    value={editingVisitor.identification?.number || ''}
                    onChange={(e) => handleInputChange('identification.number', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 text-sm ${
                      isEditMode
                        ? idError
                          ? ''
                          : ''
                        : 'cursor-not-allowed'
                    }`}
                    style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${isEditMode && idError ? DANGER : 'transparent'}`, borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = isEditMode && idError ? DANGER : PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isEditMode && idError ? DANGER : 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  />
                  {isEditMode && idError && (
                    <p className="mt-1 text-xs" style={{ color: DANGER }}>{idError}</p>
                  )}
                  {isEditMode && editingVisitor.identification?.id_type === 'National ID' &&
                   editingVisitor.identification?.number &&
                   !idError && (
                    <p className="mt-1 text-xs" style={{ color: SUCCESS }}>✓ National ID format valid</p>
                  )}
              </div>
            </div>
          </div>

          {/* Vehicle Information Section */}
          <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
              <FiRefreshCw className="w-5 h-5" style={{ color: SUCCESS }} />
              Vehicle Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Has Vehicle */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  Has Vehicle
                </label>
                <select
                  value={editingVisitor.vehicle_storage?.has_vehicle ? 'true' : 'false'}
                  disabled
                  className="w-full px-3 py-2 text-sm cursor-not-allowed" style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: '#555555' }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              {/* License Plate */}
              <div>
                <label className="block uppercase mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                  License Plate
                </label>
                <input
                  type="text"
                  value={editingVisitor.vehicle_storage?.vehicle_details?.plate_number || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm cursor-not-allowed" style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: '#555555' }}
                  placeholder="e.g., RAB123A"
                />
              </div>
            </div>
          </div>

          {/* Department Assignments Section */}
          <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
              <FiCheckCircle className="w-5 h-5" style={{ color: ACCENT_DARK_BLUE }} />
              Department Assignments
            </h3>
            <div className="space-y-3">
              {editingVisitor.departments_assigned?.map((dept: any, index: number) => (
                <div key={index} className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <span className="uppercase" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Department</span>
                      <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{dept.department_name}</p>
                    </div>
                    <div>
                      <span className="uppercase" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Assigned Time</span>
                      <p className="text-sm" style={{ color: '#555555' }}>
                        {new Date(dept.assigned_time).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="uppercase" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Provider</span>
                      <p className="text-sm" style={{ color: '#555555' }}>{dept.provider_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="uppercase block mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Reached</span>
                      <div className="flex">
                        <span className="inline-flex px-2 py-1 text-xs font-medium" style={{
                          backgroundColor: dept.reached_in ? 'rgba(76,175,80,0.12)' : 'rgba(243,156,18,0.12)',
                          color: dept.reached_in ? SUCCESS : WARNING,
                        }}>
                          {dept.reached_in ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* This section replaces the read-only Service Status badge with live serve/transfer actions */}
          {(() => {
            if (!visitor) return null;

            // Derive MY service status from the raw visitor data (same logic as ProvideServicesTab)
            const currentUser = user as any;
            const myId = String(
              currentUser?.userId || currentUser?._id || currentUser?.id || '',
            );
            const myAssignment = visitor?.departments_assigned?.find(
              (d: any) => String(d.provider_id) === myId,
            );
            const serviceDuration = visitor?.durations?.services_durations?.find(
              (d: any) => String(d.provider_id) === myId && d.ended_at === null,
            );
            const serviceStartTimeVal = serviceDuration?.started_at || "";

            let myServiceStatus: any = null;
            if (Array.isArray(visitor?.services_status)) {
              myServiceStatus = visitor.services_status.find(
                (s: any) => String(s.provider_id) === myId,
              );
            } else if (visitor?.services_status && typeof visitor.services_status === "object") {
              if (String(visitor.services_status.provider_id) === myId) {
                myServiceStatus = visitor.services_status;
              }
            }

            const status = (myServiceStatus?.s_type || visitor.status || "Not started");

            // Department name for service
            const deptName = myAssignment?.department_name || visitor._departmentGroup || "General Service";

            // ── COMPLETED ──────────────────────────────────────────────
            if (status === "Completed" || status === "completed") {
              return (
                <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
                  <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: SUCCESS }}>
                    <FiCheckCircle className="w-5 h-5" />
                    Service Completed
                  </h3>
                  <div className="flex items-center gap-4 p-5" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}>
                      <FiCheckCircle className="w-7 h-7" style={{ color: SUCCESS }} />
                    </div>
                    <div>
                      <p className="text-sm uppercase" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Status</p>
                      <p className="text-xl font-bold mt-0.5" style={{ fontFamily: fontHeading, color: SUCCESS }}>✓ Completed</p>
                      <p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>Service delivered by {visitor?.services_status?.[0]?.provider_name || "Staff"}</p>
                    </div>
                  </div>
                </div>
              );
            }

            // ── IN PROGRESS ────────────────────────────────────────────
            if (status === "Inprogress" || status === "inprogress") {
              return  <></>
            }

            // ── NOT STARTED or TRANSFERRED ─────────────────────────────
            return <></>;
          })()}


          {/* Notes Section */}
          <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
              <FiUser className="w-5 h-5" style={{ color: NEUTRAL_DARK }} />
              Notes & Comments
            </h3>
            <div className="space-y-3">
              {editingVisitor.notes?.map((note: any, index: number) => (
                <div key={index} className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{note.writter_name}</span>
                    <span className="text-xs" style={{ color: GRAY_DISABLED }}>
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#555555' }}>{note.message}</p>
                </div>
              ))}
              {(!editingVisitor.notes || editingVisitor.notes.length === 0) && (
                <p className="text-sm italic" style={{ color: GRAY_DISABLED }}>No notes available</p>
              )}
            </div>
          </div>

          {/* Status Information Section */}
          <div className="p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <h3 className="text-lg mb-4 flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
              <FiCheckCircle className="w-5 h-5" style={{ color: PRIMARY }} />
              Status Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <span className="uppercase block mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Entry Date</span>
                <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                  {editingVisitor.entry_date ? new Date(editingVisitor.entry_date).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <span className="uppercase block mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Exit Date</span>
                <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                  {editingVisitor.exist_date ? new Date(editingVisitor.exist_date).toLocaleString() : 'Still In-house'}
                </p>
              </div>
              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <span className="uppercase block mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Is Being Served</span>
                <span className="inline-flex px-2 py-1 text-xs font-medium" style={{
                  backgroundColor: editingVisitor.is_being_served ? 'rgba(76,175,80,0.12)' : 'rgba(231,76,60,0.1)',
                  color: editingVisitor.is_being_served ? SUCCESS : DANGER,
                }}>
                  {editingVisitor.is_being_served ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                <span className="uppercase block mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>Still In-house</span>
                <span className="inline-flex px-2 py-1 text-xs font-medium" style={{
                  backgroundColor: editingVisitor.is_still_inhouse ? 'rgba(76,175,80,0.12)' : 'rgba(231,76,60,0.1)',
                  color: editingVisitor.is_still_inhouse ? SUCCESS : DANGER,
                }}>
                  {editingVisitor.is_still_inhouse ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions — dual mode: serve buttons (view) / save button (edit) */}
        <div className="p-6" style={{ backgroundColor: WHITE, borderTop: `1px solid ${BORDER}` }}>
          {isEditMode ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={handleUpdateVisitor}
                disabled={updating || !!idError || !!emailError}
                className="px-6 py-2 uppercase transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: SUCCESS, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
              >
                {updating ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Saving updates...
                  </>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    Save updates
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                onClick={handleTransferClick}
                disabled={isServing}
                className="flex items-center gap-2 h-10 px-5 text-[13px] uppercase transition-colors disabled:opacity-50"
                style={{ backgroundColor: ACCENT_DARK_BLUE, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2471A3'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK_BLUE; }}
              >
                <FiArrowRightCircle className="w-4 h-4" /> Transfer
              </button>
              <button
                onClick={handleServeClick}
                disabled={isServing}
                className="flex items-center gap-2 h-10 px-6 text-[13px] uppercase transition-colors disabled:opacity-50"
                style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                {(() => {
                  if (!visitor) return null;
                  const currentUser = user as any;
                  const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || '');
                  const serviceDuration = visitor?.durations?.services_durations?.find(
                    (d: any) => String(d.provider_id) === myId && d.ended_at === null,
                  );
                  const hasActiveService = !!serviceDuration;
                  return (
                    <>
                      {hasActiveService ? <FiSquare className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
                      {hasActiveService ? 'End Service' : 'Serve'}
                    </>
                  );
                })()}
              </button>
            </div>
          )}
        </div>

        {/* ======== Serve Visitor Modal ======== */}
        {showServeModal && selectedVisitorForServe && (
          <ServeVisitorModal
            isOpen={showServeModal}
            onClose={() => {
              setShowServeModal(false);
              setSelectedVisitorForServe(null);
            }}
            visitor={selectedVisitorForServe}
            onServiceEnd={handleServiceComplete}
          />
        )}

        {/* ======== Transfer Visitor Modal ======== */}
        {showTransferModal && visitor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md overflow-visible" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[20px]" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
                    Transfer Visitor
                  </h2>
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferVisitor(null);
                      setTransferDepartment("");
                      setTransferEmployee(null);
                      setTransferEmployees([]);
                      setUnits([]);
                      setSelectedUnit("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                {/* Visitor summary card */}
                <div className="mb-4">
                  <label className="block uppercase mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                    Visitor
                  </label>
                  <div className="flex items-center gap-3 p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: ACCENT_DARK_BLUE }}>
                      <span>{(visitor.full_name || "?")[0]}</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium" style={{ color: NEUTRAL_DARK }}>
                        {visitor.full_name}
                      </div>
                      <div className="text-[12px]" style={{ color: GRAY_DISABLED }}>
                        Badge: {visitor.badge_number || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Select Department */}
                <div className="mb-4">
                  <label className="block uppercase mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                    Select Department
                  </label>
                  <select
                    value={transferDepartment}
                    onChange={(e) => handleTransferDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 h-[42px] text-[13px]"
                    style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  >
                    <option value="">Choose a department…</option>
                    {departments.map((dept: any) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.department_name || "Unknown"}
                        {dept.total_employees > 0 && ` (${dept.total_employees} staff)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Unit (Optional) */}
                {transferDepartment && (
                  <div className="mb-4">
                    <label className="block uppercase mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: TERTIARY }}>
                      Select Unit (Optional)
                    </label>
                    {transferEmployeesLoading ? (
                      <div className="w-full px-3 py-2 text-sm flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                        <FiLoader className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                        <span style={{ color: GRAY_DISABLED }}>Loading units…</span>
                      </div>
                    ) : (
                      <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="w-full px-3 py-2 text-[13px]"
                        style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                      >
                        <option value="">No specific unit — assign to department only</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.staffAvailable} staff)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferVisitor(null);
                      setTransferDepartment("");
                      setTransferEmployee(null);
                      setTransferEmployees([]);
                      setUnits([]);
                      setSelectedUnit("");
                    }}
                    className="flex-1 px-4 py-2 uppercase hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransferVisitor}
                    disabled={!transferDepartment || transferring}
                    className="flex-1 px-4 py-2 uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                  >
                    {transferring ? (
                      <>
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                        Transferring…
                      </>
                    ) : (
                      "Transfer Visitor"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateTaskModal && (
          <CreateTaskModal
            onClose={() => setShowCreateTaskModal(false)}
            onSuccess={() => {
              setShowCreateTaskModal(false);
              showSuccess('Task created successfully');
            }}
            TaskStatus="Under-review"
            belongs={{
              isBelongsTo: true,
              itBelongsTo: visitorId
            }}
            belongsToName={visitor?.full_name}
            belongsToEmail={visitor?.email}
            belongstoTelephone={visitor?.telephone}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default VisitorDetailsPage;