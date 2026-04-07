// ProvideServicesTab - Service Provision page with Serve Modal
// NOW REUSABLE: Can be embedded in the Dashboard or viewed standalone.

import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiClock,
  FiCheckCircle,
  FiRefreshCw,
  FiSquare,
  FiArrowRightCircle,
  FiX,
} from "react-icons/fi";

import { ServeVisitorModal } from "../index";
import { Pagination } from "../../shared";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import {
  serviceDeliveryService,
  departmentService,
  employeeService,
} from "../../../../../core/services/adminService";

// Custom Live Timer Component.
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

  const h = Math.floor(elapsed / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <span className="font-mono tracking-widest">
      {h}:{m}:{s}
    </span>
  );
};

interface SelectedVisitor {
  id: string;
  name: string;
  visitorId: string;
  badgeNumber: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
  status: string;
  serviceStartTime: string;
  rawVisitor: any;
}

interface ServiceRequest {
  id: string;
  visitorName: string;
  visitorId: string;
  badgeNumber: string;
  assignedTo: string;
  serviceType: string;
  waitTime: string;
  avatarColor: string;
  initials: string;
  status:
    | "Not started"
    | "not started"
    | "inprogress"
    | "completed"
    | "transfered";
  serviceStartTime: string;
  telephone: string;
  checkInRaw: string;
  rawVisitor: any;
  not_transferred_to_me: boolean;
}

// Allow the component to know if it's being rendered inside the Dashboard
export interface ProvideServicesTabProps {
  isDashboardView?: boolean;
}

const ProvideServicesTab: React.FC<ProvideServicesTabProps> = ({
  isDashboardView = false,
}) => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] =
    useState<SelectedVisitor | null>(null);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServing, setIsServing] = useState(false);
  const [stats, setStats] = useState({
    waitAvg: "0m",
    waiting: 0,
    completed: 0,
  });

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<ServiceRequest | null>(
    null,
  );
  const [transferDepartment, setTransferDepartment] = useState<string>("");
  const [transferEmployee, setTransferEmployee] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] =
    useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const entriesPerPage = 5;

  const fetchAssignedVisitors = useCallback(
    async (silent: boolean = false) => {
      const currentUser = user as any;
      const myId = String(
        currentUser?.userId ||
          currentUser?._id ||
          currentUser?.id ||
          currentUser?.employee_id ||
          "",
      );
      const myName = String(
        currentUser?.full_name ||
          currentUser?.fullName ||
          currentUser?.name ||
          "Unknown",
      ).trim();

      if (!myId || myId === "undefined") {
        if (!silent) setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        // 👉 NEW: Use the updated backend endpoint that returns ALL visitors (assigned and unassigned)
        const response =
          (await serviceDeliveryService.getCurrentVisitorsByProvider(
            myId,
          )) as any;

        if (response && response.success && response.data) {
          // The backend now returns visitors grouped by department (including "Unassigned")
          const departmentGroups = response.data;

          // Flatten all visitors from all department groups into a single array
          const allVisitors: any[] = [];
          departmentGroups.forEach((group: any) => {
            allVisitors.push(group);
          });

          // 👉 MAPPING LOGIC: Format the data perfectly for the table also no reason to filter
          const formattedRequests: ServiceRequest[] = allVisitors.map(
            (v: any) => {
              const myServiceStatus =
                v.services_status.length !== 0
                  ? v.services_status.reverse()[0]
                  : null;

              console.log("My services status", myServiceStatus);
              // we don't have to filter because backend already did
              const myDeptAssign =
                v.departments_assigned?.length !== 0
                  ? v.departments_assigned.reverse()[0]
                  : null;

              console.log("My department assign", myDeptAssign);

              let status:
                | "Not started"
                | "inprogress"
                | "completed"
                | "transfered" = "Not started";
              let assignedToDisplay = myDeptAssign?.provider_name || "None";
              let serviceStartTime = "";
              let checkIn = v.entry_date || new Date().toISOString();

              if (true) {
                // Read my explicit status
                const rawStatus = myServiceStatus?.s_type || v.status || "";
                const normalizedStatus = rawStatus.toLowerCase();
                if (normalizedStatus === "completed") status = "completed";
                else if (normalizedStatus === "inprogress")
                  status = "inprogress";
                else if (
                  normalizedStatus === "transfered" ||
                  normalizedStatus === "transferred"
                )
                  status = "transfered";
                else status = "Not started";

                checkIn =
                  myDeptAssign?.assigned_time ||
                  v.entry_date ||
                  new Date().toISOString();
                const serviceDuration = v.durations?.services_durations?.find(
                  (d: any) => String(d.provider_id) === myId && d.ended_at === null,
                );
                serviceStartTime = serviceDuration?.started_at || "";
              }

              const colors = [
                "bg-purple-500",
                "bg-pink-500",
                "bg-yellow-400",
                "bg-teal-500",
                "bg-lavender-400",
                "bg-blue-500",
              ];
              const visitorName =
                v.full_name || v.name || v.visitorName || "Unknown";
              const colorIndex = visitorName.charCodeAt(0) % colors.length;
              const initials = visitorName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              let identification = "N/A";
              if (typeof v.identification === "string")
                identification = v.identification;
              else if (v.identification?.number)
                identification = v.identification.number;

              let badgeNumber = "";
              if (v.badge_number) badgeNumber = v.badge_number;

              const checkInTime =
                myDeptAssign?.assigned_time ||
                v.entry_date ||
                new Date().toISOString();

              const serviceDuration = v.durations?.services_durations?.find(
                (d: any) => String(d.provider_id) === myId && d.ended_at === null,
              );
              const serviceStartTimeVal = serviceDuration?.started_at || "";

              const waitTimeEndStamp =
                (status === "inprogress" ||
                  status === "completed" ||
                  status === "transfered") &&
                serviceStartTimeVal
                  ? new Date(serviceStartTimeVal).getTime()
                  : new Date().getTime();

              let waitTimeString = "Just now";
              if (checkInTime) {
                const diffMins = Math.floor(
                  (waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000,
                );
                if (diffMins > 0) {
                  const hours = Math.floor(diffMins / 60);
                  const mins = diffMins % 60;
                  waitTimeString =
                    hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
                }
              }

              return {
                id: v._id || v.id,
                visitorName: visitorName,
                visitorId: identification,
                badgeNumber: badgeNumber,
                assignedTo: assignedToDisplay,
                serviceType:
                  myServiceStatus?.department_name ||
                  myDeptAssign?.department_name ||
                  v._departmentGroup ||
                  "General Service",
                waitTime: waitTimeString,
                avatarColor: colors[colorIndex],
                initials: initials,
                status: status,
                serviceStartTime: serviceStartTimeVal,
                telephone: v.telephone || "N/A",
                checkInRaw: checkInTime,
                rawVisitor: v,
                not_transferred_to_me: myServiceStatus
                  ? String(myServiceStatus.provider_id) !== myId &&
                    myServiceStatus.s_type.toLowerCase() === "transferred"
                  : false,
              };
            },
          );

          formattedRequests.reverse();
          setRequests(formattedRequests);

          const completedCount = formattedRequests.filter(
            (r) => r.status === "completed",
          ).length;
          const waitingCount = formattedRequests.filter(
            (r) => r.status === "Not started",
          ).length;

          setStats({
            waitAvg: "12m 30s",
            waiting: waitingCount,
            completed: completedCount,
          });
        }
      } catch (error) {
        console.error("Error fetching assigned visitors:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchAssignedVisitors(false);
  }, [fetchAssignedVisitors]);

  const fetchDepartments = async () => {
    try {
      const response = (await departmentService.getAll()) as any;
      if (response && (response.data || Array.isArray(response))) {
        setDepartments(Array.isArray(response.data) ? response.data : response);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filteredRequests = requests
    .filter((request) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        request.visitorName.toLowerCase().includes(searchLower) ||
        request.visitorId.toLowerCase().includes(searchLower) ||
        request.badgeNumber.toLowerCase().includes(searchLower) ||
        request.telephone?.toLowerCase().includes(searchLower);

      let normalizedStatus = request.status.replace("_", "-");
      if (normalizedStatus === "transfered") normalizedStatus = "transferred";
      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        inprogress: 1,
        transfered: 2,
        transferred: 2,
        "Not started": 3,
        "not-started": 3,
        completed: 4,
      };
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      return orderA - orderB;
    });

  const totalFilteredPages = Math.ceil(
    filteredRequests.length / entriesPerPage,
  );
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedRequests = filteredRequests.slice(
    startIndex,
    startIndex + entriesPerPage,
  );

  const updateBackendStatus = async (
    targetStatus: string,
    visitorId: string,
    rawVisitor: any,
    isStart: boolean = false,
    durationStr: string = "",
    notes: string = "",
  ) => {
    const currentUser = user as any;
    const myId = String(
      currentUser?.userId ||
        currentUser?._id ||
        currentUser?.id ||
        currentUser?.employee_id ||
        "",
    );
    const myName = String(
      currentUser?.full_name ||
        currentUser?.fullName ||
        currentUser?.name ||
        "Unknown",
    );
    const myDeptId = String(
      currentUser?.department?._id ||
        currentUser?.department_id ||
        currentUser?.department ||
        "",
    );
    const myUnitId = String(currentUser?.department_unit || "");

    // Try to find exact assignment first
    // Note: services_status is now a single object (not an array) after backend aggregation
    let deptInfo =
      rawVisitor.departments_assigned?.find(
        (d: any) => String(d.provider_id) === myId,
      ) ||
      (rawVisitor.services_status &&
      typeof rawVisitor.services_status === "object" &&
      String(rawVisitor.services_status.provider_id) === myId
        ? rawVisitor.services_status
        : null);

    // 👉 FIX: If no exact assignment, find the unit assignment
    if (!deptInfo) {
      deptInfo = rawVisitor.departments_assigned?.find((d: any) => {
        const dId = String(d.department_id);
        return true;
      });
    }

    // Handle both array and object cases for services_status
    // After backend aggregation, services_status is a single object, not an array
    let updatedServicesStatus: any[] = [];
    if (Array.isArray(rawVisitor.services_status)) {
      updatedServicesStatus = rawVisitor.services_status.filter(
        (s: any) => String(s.provider_id) !== String(myId),
      );
    } else if (
      rawVisitor.services_status &&
      typeof rawVisitor.services_status === "object"
    ) {
      // If it's a single object, only include it if it's not for the current provider
      if (String(rawVisitor.services_status.provider_id) !== String(myId)) {
        updatedServicesStatus = [rawVisitor.services_status];
      }
    }
    updatedServicesStatus.push({
      department_id: deptInfo?.department_id || "",
      department_name: deptInfo?.department_name || "General",
      provider_name: myName,
      provider_id: myId,
      s_type: targetStatus,
    });

    const currentDurations = rawVisitor.durations || {
      services_durations: [],
      emergency_durations: [],
    };
    const existingServiceDurations = currentDurations.services_durations || [];
    const existingRecordIndex = existingServiceDurations.findIndex(
      (d: any) => String(d.provider_id) === myId,
    );

    let updatedServiceDurations = [...existingServiceDurations];

    if (isStart) {
      if (existingRecordIndex === -1) {
        updatedServiceDurations.push({
          department_id: deptInfo?.department_id || "",
          department_name: deptInfo?.department_name || "General",
          provider_name: myName,
          provider_id: myId,
          started_at: new Date().toISOString(),
        });
      } else {
        updatedServiceDurations[existingRecordIndex] = {
          ...updatedServiceDurations[existingRecordIndex],
          started_at: new Date().toISOString(),
        };
      }
    } else if (!isStart && durationStr && existingRecordIndex !== -1) {
      updatedServiceDurations[existingRecordIndex] = {
        ...updatedServiceDurations[existingRecordIndex],
        ended_at: new Date().toISOString(),
        duration: durationStr,
      };
    }

    await serviceDeliveryService.updateServiceStatus({
      visitor_id: visitorId,
      status: targetStatus,
      notes: notes
    });
  };

  const handleTransferVisitor = async () => {

    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);
    try {
      const currentUser = user as any;
      const myId = String(
        currentUser?.userId ||
          currentUser?._id ||
          currentUser?.id ||
          currentUser?.employee_id ||
          "",
      );
      const myName = String(
        currentUser?.full_name ||
          currentUser?.fullName ||
          currentUser?.name ||
          "Unknown",
      );

      // Determine target: unit if selected, else department
      const targetId = selectedUnit || transferDepartment;
      const targetInfo = selectedUnit
        ? units.find((u) => u.id === selectedUnit)
        : departments.find((d) => d._id === transferDepartment);
      const targetName = targetInfo?.name || "Unknown";

      const currentDept =
        transferVisitor.rawVisitor?.departments_assigned?.find(
          (d: any) => String(d.provider_id) === myId,
        );
      const previousDepartmentId = currentDept?.department_id;

      // Only assign specific provider if employee selected
      const providerId = transferEmployee
        ? String(transferEmployee._id || transferEmployee.employee_id || "")
        : undefined;
      const providerName = transferEmployee
        ? String(transferEmployee.full_name || "")
        : undefined;

      setRequests((prev) =>
        prev.map((r) =>
          r.id === transferVisitor.id
            ? {
                ...r,
                status: "transfered",
                assignedTo:
                  providerName || `${targetName}` || "Transferred",
              }
            : r,
        ),
      );

      await serviceDeliveryService.assignToDepartment(
        transferVisitor.id,
        targetId,
        targetName,
        providerId,
        providerName,
        previousDepartmentId,
      );

      setShowTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment("");
      setTransferEmployee(null);
      setTransferEmployees([]);
      setUnits([]);
      setSelectedUnit("");

      fetchAssignedVisitors(true);
    } catch (error) {

      console.error("Error transferring visitor:", error);
      alert("Failed to transfer visitor. Please try again.");
      fetchAssignedVisitors(true);
    } finally {
      setTransferring(false);
    }
  };

  const fetchTransferEmployees = async (deptId: string) => {
    if (!deptId) {
      setTransferEmployees([]);
      return;
    }
    setTransferEmployeesLoading(true);
    try {
      const response = (await employeeService.getByDepartment(
        deptId,
        false,
      )) as any;
      if (response && (response.data || Array.isArray(response))) {
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
      const response = await departmentService.getAll();
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
          currentQueue: 0, // We don't have counts here
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

  const handleTransferClick = (request: ServiceRequest) => {
    if (request.status === "completed") return;
    setTransferVisitor(request);
    setTransferDepartment("");
    setTransferEmployee(null);
    setTransferEmployees([]);
    setUnits([]);
    setSelectedUnit("");
    setShowTransferModal(true);
  };

  const handleTransferDepartmentChange = (deptId: string) => {
    setTransferDepartment(deptId);
    setTransferEmployee(null);
    setSelectedUnit("");
    if (deptId) {
      loadUnitsByDepartment(deptId);
      fetchTransferEmployees(deptId); // Keep for potential employee selection, but we'll make it optional
    } else {
      setUnits([]);
      setTransferEmployees([]);
    }
  };

  const handleServeClick = async (request: ServiceRequest) => {
    if (request.status === "completed") return;

    let currentStatus = request.status;
    let startTime = request.serviceStartTime;

    if (request.status === "Not started" || request.status === "transfered") {
      currentStatus = "inprogress";
      startTime = new Date().toISOString();

      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, status: "inprogress", serviceStartTime: startTime }
            : r,
        ),
      );

      await updateBackendStatus(
        "Inprogress",
        request.id,
        request.rawVisitor,
        true,
      );
      fetchAssignedVisitors(true);
    }

    setSelectedVisitor({
      id: request.id,
      name: request.visitorName,
      visitorId: request.visitorId,
      badgeNumber: request.badgeNumber,
      email: request.telephone,
      service: request.serviceType,
      checkInTime: request.checkInRaw
        ? new Date(request.checkInRaw).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "N/A",
      gate: "Main Reception",
      status: currentStatus,
      serviceStartTime: startTime,
      rawVisitor: request.rawVisitor,
    });

    setShowModal(true);
  };

  const handleServiceComplete = async (data: any) => {
    if (!selectedVisitor) return;
    setIsServing(true);

    try {
      const isTransfer =
        data.notes && data.notes.toLowerCase().includes("transfer");
      const targetStatus = isTransfer ? "Transfered" : "Completed";

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedVisitor.id
            ? { ...r, status: targetStatus as any }
            : r,
        ),
      );

      await updateBackendStatus(
        targetStatus,
        selectedVisitor.id,
        selectedVisitor.rawVisitor,
        false,
        data.duration,
        data.notes,
      );

      setShowModal(false);
      setSelectedVisitor(null);
      fetchAssignedVisitors(true);
    } catch (error) {
      console.error("Failed to process service:", error);
      alert("Failed to process request. Please try again.");
    } finally {
      setIsServing(false);
    }
  };

  return (
    <div className={isDashboardView ? "" : "p-7"}>
      {!isDashboardView && (
        <>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-[#1a2744] text-[32px] font-extrabold">
                Service Provision
              </h1>
              <p className="text-[#888] text-[13px] mt-1.5">
                Manage active visitor requests, track wait times, and provision
                services efficiently.
              </p>
            </div>
            <button
              onClick={() => fetchAssignedVisitors(false)}
              className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50 transition-colors"
            >
              <FiRefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh Data
            </button>
          </div>

          <div className="flex gap-5 mt-7">
            <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
              <div className="flex justify-between items-start">
                <span className="text-[#999] text-[11px] uppercase tracking-wider">
                  AVG. SERVICE TIME
                </span>
                <FiClock className="text-[#90a4ae] w-7 h-7" />
              </div>
              <div className="text-[#1a2744] text-[28px] font-bold mt-3">
                {stats.waitAvg}
              </div>
            </div>
            <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
              <div className="flex justify-between items-start">
                <span className="text-[#999] text-[11px] uppercase tracking-wider">
                  WAITING VISITORS
                </span>
                <div className="text-[#90a4ae]">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <div className="text-[#1a2744] text-[28px] font-bold mt-3">
                {stats.waiting}
              </div>
            </div>
            <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
              <div className="flex justify-between items-start">
                <span className="text-[#999] text-[11px] uppercase tracking-wider">
                  COMPLETED TODAY
                </span>
                <FiCheckCircle className="text-[#34a853] w-7 h-7" />
              </div>
              <div className="text-[#1a2744] text-[28px] font-bold mt-3">
                {stats.completed}
              </div>
            </div>
          </div>
        </>
      )}

      <div
        className={`bg-white rounded-[14px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] ${!isDashboardView ? "mt-6" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by visitor name, ID, or badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8] bg-white"
          >
            <option value="all">All Status</option>
            <option value="not-started">Not Started</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {isDashboardView && (
            <button
              onClick={() => fetchAssignedVisitors(false)}
              className="flex items-center gap-2 h-11 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-6 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[25%]">
                VISITOR
              </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[20%]">
                BADGE & ID
              </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
                ASSIGNED TO
              </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
                WAIT TIME
              </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
                STATUS
              </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[10%]">
                ACTION
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Loading requests...
                </td>
              </tr>
            ) : paginatedRequests.length > 0 ? (
              paginatedRequests.map((request) => (
                <tr key={request.id} className="border-b border-[#f8f8f8] h-14">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}
                      >
                        {request.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[#333] text-[13px] font-medium truncate">
                          {request.visitorName}
                        </div>
                        <div className="text-[#888] text-[11px] truncate">
                          {request.telephone !== "____"
                            ? request.telephone
                            : "No phone"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-2">
                    <div className="text-[#333] text-[13px] font-medium">
                      {request.badgeNumber
                        ? `Badge: ${request.badgeNumber}`
                        : "No Badge"}
                    </div>
                    <div className="text-[#888] text-[11px]">
                      ID: {request.visitorId}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-[#333] text-[13px] font-medium">
                    {request.assignedTo}
                  </td>
                  <td className="py-3 px-2 text-[#666] text-[13px] font-medium">
                    {request.waitTime}
                  </td>
                  <td className="py-3 px-2">
                    {request.status === "Not started" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#fff3e0] text-[#f57c00]">
                        Not Started
                      </span>
                    )}
                    {request.status === "inprogress" && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e3f2fd] text-[#1a73e8]">
                        <FiClock className="w-3 h-3 animate-pulse" />
                        <LiveTimer startTime={request.serviceStartTime} />
                      </span>
                    )}
                    {request.status === "completed" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e8f5e9] text-[#2e7d32]">
                        Completed
                      </span>
                    )}
                    {request.status === "transfered" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#f3e5f5] text-[#7b1fa2]">
                        Transferred
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {request.status === "completed" ? (
                      <span className="text-[#34a853] text-[12px] font-medium">
                        ✓ Served
                      </span>
                    ) : request.not_transferred_to_me === true ? (
                      <span className="text-[#7b1fa2] text-[12px] font-medium">
                        ⇄ Transferred Away
                      </span>
                    ) : request.status === "inprogress" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleServeClick(request)}
                          disabled={isServing}
                          className="h-8 w-20 bg-[#e53935] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <FiSquare className="w-3 h-3 fill-current" /> Stop
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleServeClick(request)}
                          disabled={isServing}
                          className="h-8 w-16 bg-[#1a73e8] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1558c0] transition-colors disabled:opacity-50"
                        >
                          Serve
                        </button>
                        <button
                          onClick={() => handleTransferClick(request)}
                          disabled={isServing}
                          className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FiArrowRightCircle className="w-3 h-3" /> Transfer
                        </button>
                      </div>
                    )}

                    {request.not_transferred_to_me === true && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTransferClick(request)}
                          disabled={isServing}
                          className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <FiArrowRightCircle className="w-3 h-3" /> Transfer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No active visitors assigned to you or your unit.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredRequests.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalFilteredPages || 1}
            onPageChange={setCurrentPage}
            style="arrows-only"
            showPageInfo={true}
            prevLabel="Previous"
            nextLabel="Next"
          />
        )}
      </div>

      <ServeVisitorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVisitor(null);
        }}
        visitor={selectedVisitor as any}
        onServiceEnd={handleServiceComplete}
      />

      {/* Transfer Modal */}
      {showTransferModal && transferVisitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[#2C3E50] text-[20px] font-semibold">
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

              <div className="mb-4">
                <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                  Visitor
                </label>
                <div className="flex items-center gap-3 p-3 bg-[#F7F9FB] rounded-lg">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${transferVisitor.avatarColor}`}
                  >
                    <span>{transferVisitor.initials}</span>
                  </div>
                  <div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {transferVisitor.visitorName}
                    </div>
                    <div className="text-[#8A94A6] text-[12px]">
                      Badge: {transferVisitor.badgeNumber || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                  Select Department
                </label>
                <select
                  value={transferDepartment}
                  onChange={(e) => handleTransferDepartmentChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white"
                >
                  <option value="">Choose department...</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.department_name || dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {transferDepartment && (
                <div className="mb-4">
                  <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                    Select Unit (Optional)
                  </label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white"
                  >
                    <option value="">No specific unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {transferDepartment && (
                <div className="mb-6">
                  <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                    Assign to Specific Employee (Optional)
                  </label>
                  <div className="relative">
                    {transferEmployeesLoading ? (
                      <div className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] bg-gray-100 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-gray-500">
                          Loading employees...
                        </span>
                      </div>
                    ) : (
                      <select
                        value={
                          transferEmployee?._id ||
                          transferEmployee?.employee_id ||
                          ""
                        }
                        onChange={(e) => {
                          const emp = transferEmployees.find(
                            (em) =>
                              String(em._id || em.employee_id) ===
                              e.target.value,
                          );
                          setTransferEmployee(emp || null);
                        }}
                        className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white cursor-pointer appearance-none"
                      >
                        <option value="">Any employee in department/unit</option>
                        {transferEmployees.map((emp) => {
                          const empId = String(
                            emp._id || emp.employee_id || "",
                          );
                          return (
                            <option key={empId} value={empId}>
                              {emp.full_name}{" "}
                              {emp.title ? `(${emp.title})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {!transferEmployeesLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
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
                  className="flex-1 px-4 py-2 border border-[#D9E1EA] text-[#2C3E50] rounded-[8px] font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferVisitor}
                  disabled={!transferDepartment || transferring}
                  className="flex-1 px-4 py-2 bg-[#0284C7] text-white rounded-[8px] font-medium hover:bg-[#0369A1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" />{" "}
                      Transferring...
                    </>
                  ) : (
                    <>
                      <FiArrowRightCircle className="w-4 h-4" /> Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvideServicesTab;
