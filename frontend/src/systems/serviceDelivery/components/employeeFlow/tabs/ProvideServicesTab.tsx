// // ProvideServicesTab - Service Provision page with Serve Modal
// // NOW REUSABLE: Can be embedded in the Dashboard or viewed standalone.

// import React, { useState, useEffect, useCallback } from "react";
// import {
//   FiSearch,
//   FiClock,
//   FiCheckCircle,
//   FiRefreshCw,
//   FiSquare,
//   FiArrowRightCircle,
//   FiX,
//   FiUser,
// } from "react-icons/fi";

// // ===== MODIFICATION: Import icons for new pagination buttons =====
// import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

// import { ServeVisitorModal } from "../index";
// // ===== REMOVED: Pagination import no longer needed (using custom buttons now) =====
// import { useAuth } from "../../../../../core/contexts/AuthContext";
// import {
//   serviceDeliveryService,
//   departmentService,
//   employeeService,
// } from "../../../../../core/services/adminService";

// // Custom Live Timer Component.
// const LiveTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
//   const [elapsed, setElapsed] = useState(0);

//   useEffect(() => {
//     if (!startTime) return;
//     const start = new Date(startTime).getTime();

//     const updateTime = () =>
//       setElapsed(
//         Math.max(0, Math.floor((new Date().getTime() - start) / 1000)),
//       );

//     updateTime();
//     const interval = setInterval(updateTime, 1000);
//     return () => clearInterval(interval);
//   }, [startTime]);

//   const h = Math.floor(elapsed / 3600)
//     .toString()
//     .padStart(2, "0");
//   const m = Math.floor((elapsed % 3600) / 60)
//     .toString()
//     .padStart(2, "0");
//   const s = (elapsed % 60).toString().padStart(2, "0");

//   return (
//     <span className="font-mono tracking-widest">
//       {h}:{m}:{s}
//     </span>
//   );
// };

// interface SelectedVisitor {
//   id: string;
//   name: string;
//   visitorId: string;
//   badgeNumber: string;
//   email: string;
//   service: string;
//   checkInTime: string;
//   gate: string;
//   status: string;
//   serviceStartTime: string;
//   rawVisitor: any;
// }

// interface ServiceRequest {
//   id: string;
//   visitorName: string;
//   visitorId: string;
//   badgeNumber: string;
//   assignedTo: string;
//   serviceType: string;
//   waitTime: string;
//   avatarColor: string;
//   initials: string;
//   status:
//     | "Not started"
//     | "not started"
//     | "inprogress"
//     | "completed"
//     | "transfered";
//   serviceStartTime: string;
//   telephone: string;
//   checkInRaw: string;
//   rawVisitor: any;
//   not_transferred_to_me: boolean;
// }

// // Allow the component to know if it's being rendered inside the Dashboard
// export interface ProvideServicesTabProps {
//   isDashboardView?: boolean;
// }

// const ProvideServicesTab: React.FC<ProvideServicesTabProps> = ({
//   isDashboardView = false,
// }) => {
//   const { user } = useAuth();

//   const [searchTerm, setSearchTerm] = useState("");
//   const [statusFilter, setStatusFilter] = useState("all");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [totalPages, setTotalPages] = useState(1);
//   const [totalCount, setTotalCount] = useState(0);
//   const [showModal, setShowModal] = useState(false);
//   const [selectedVisitor, setSelectedVisitor] =
//     useState<SelectedVisitor | null>(null);

//   const [requests, setRequests] = useState<ServiceRequest[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [isServing, setIsServing] = useState(false);
//   const [stats, setStats] = useState({
//     waitAvg: "0m",
//     waiting: 0,
//     completed: 0,
//   });

//   // Transfer Modal State
//   const [showTransferModal, setShowTransferModal] = useState(false);
//   const [transferVisitor, setTransferVisitor] = useState<ServiceRequest | null>(
//     null,
//   );
//   const [transferDepartment, setTransferDepartment] = useState<string>("");
//   const [transferEmployee, setTransferEmployee] = useState<any>(null);
//   const [transferring, setTransferring] = useState(false);
//   const [departments, setDepartments] = useState<any[]>([]);
//   const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
//   const [transferEmployeesLoading, setTransferEmployeesLoading] =
//     useState(false);
//   const [units, setUnits] = useState<any[]>([]);
//   const [selectedUnit, setSelectedUnit] = useState<string>("");

//   // ===== NEW FEATURE: Visitor Details Modal State =====
//   // Added for showing visitor details popup when clicking on visitor name
//   const [showVisitorDetails, setShowVisitorDetails] = useState(false);
//   const [detailsVisitor, setDetailsVisitor] = useState<ServiceRequest | null>(null);

//   const fetchAssignedVisitors = useCallback(
//     async (silent: boolean = false, page: number = currentPage, query: string = searchTerm) => {
//       const currentUser = user as any;
//       const myId = String(
//         currentUser?.userId ||
//           currentUser?._id ||
//           currentUser?.id ||
//           currentUser?.employee_id ||
//           "",
//       );
//       const myName = String(
//         currentUser?.full_name ||
//           currentUser?.fullName ||
//           currentUser?.name ||
//           "Unknown",
//       ).trim();

//       if (!myId || myId === "undefined") {
//         if (!silent) setLoading(false);
//         return;
//       }

//       try {
//         if (!silent) setLoading(true);
//         let response;
//         if (query && query.trim()) {
//           response = await serviceDeliveryService.search(query, page, 20);
//         } else {
//           response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, 20);
//         }

//         if (response && response.success) {
//           const allVisitors: any[] = response.data || [];

//           setTotalCount(response.total || 0);
//           setTotalPages(Math.ceil((response.total || 0) / 20));

//           const formattedRequests = allVisitors.map((v: any) => {
//             const colors = [
//               "bg-purple-500",
//               "bg-pink-500",
//               "bg-yellow-400",
//               "bg-teal-500",
//               "bg-lavender-400",
//               "bg-blue-500",
//             ];
//             const visitorName =
//               v.full_name || v.name || v.visitorName || "Unknown";
//             const colorIndex = visitorName.charCodeAt(0) % colors.length;
//             const initials = visitorName
//               .split(" ")
//               .map((n: string) => n[0])
//               .join("")
//               .substring(0, 2)
//               .toUpperCase();

//             let identification = "N/A";
//             if (typeof v.identification === "string")
//               identification = v.identification;
//             else if (v.identification?.number)
//               identification = v.identification.number;

//             let badgeNumber = "";
//             if (v.badge_number) badgeNumber = v.badge_number;

//             // Find assignment for current provider
//             const myAssignment = v.departments_assigned?.find(
//               (d: any) => String(d.provider_id) === myId
//             );

//             const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();

//             // Find service duration for current provider
//             const serviceDuration = v.durations?.services_durations?.find(
//               (d: any) => String(d.provider_id) === myId && d.ended_at === null,
//             );
//             const serviceStartTimeVal = serviceDuration?.started_at || "";

//             // Find service status
//             let myServiceStatus = null;
//             if (Array.isArray(v.services_status)) {
//               myServiceStatus = v.services_status.find(
//                 (s: any) => String(s.provider_id) === myId
//               );
//             } else if (v.services_status && typeof v.services_status === "object") {
//               if (String(v.services_status.provider_id) === myId) {
//                 myServiceStatus = v.services_status;
//               }
//             }

//             let status = (myServiceStatus?.s_type || v.status || "Not started").toLowerCase();
//             if (status === "not started") status = "Not started";
//             if (status === "inprogress") status = "inprogress";
//             if (status === "completed") status = "completed";
//             if (status === "transfered" || status === "transferred") status = "transfered";

//             const waitTimeEndStamp = 
//               (status === "inprogress" || status === "completed" || status === "transfered") && serviceStartTimeVal
//                 ? new Date(serviceStartTimeVal).getTime()
//                 : new Date().getTime();

//             let waitTimeString = "Just now";
//             if (checkInTime) {
//               const diffMins = Math.floor(
//                 (waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000,
//               );
//               if (diffMins > 0) {
//                 const hours = Math.floor(diffMins / 60);
//                 const mins = diffMins % 60;
//                 waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
//               }
//             }

//             const assignedToDisplay = myAssignment?.provider_name || myAssignment?.department_name || "Unassigned";

//             return {
//               id: v._id || v.id,
//               visitorName: visitorName,
//               visitorId: identification,
//               badgeNumber: badgeNumber,
//               assignedTo: assignedToDisplay,
//               serviceType: myAssignment?.department_name || v._departmentGroup || "General Service",
//               waitTime: waitTimeString,
//               avatarColor: colors[colorIndex],
//               initials: initials,
//               status: status,
//               serviceStartTime: serviceStartTimeVal,
//               telephone: v.telephone || "N/A",
//               checkInRaw: checkInTime,
//               rawVisitor: v,
//               not_transferred_to_me: myServiceStatus 
//                 ? String(myServiceStatus.provider_id) !== myId && 
//                   myServiceStatus.s_type?.toLowerCase() === "transferred"
//                 : false,
//             };
//           });

//           formattedRequests.reverse();
//           setRequests(formattedRequests);

//           const completedCount = formattedRequests.filter(
//             (r) => r.status === "completed",
//           ).length;
//           const waitingCount = formattedRequests.filter(
//             (r) => r.status === "Not started",
//           ).length;

//           setStats({
//             waitAvg: "12m 30s",
//             waiting: waitingCount,
//             completed: completedCount,
//           });
//         }
//       } catch (error) {
//         console.error("Error fetching assigned visitors:", error);
//       } finally {
//         if (!silent) setLoading(false);
//       }
//     },
//     [user, currentPage, searchTerm],
//   );

//   useEffect(() => {
//     fetchAssignedVisitors(false);
//   }, [fetchAssignedVisitors]);

//   const fetchDepartments = async () => {
//     try {
//       const response = (await departmentService.getAll()) as any;
//       if (response && (response.data || Array.isArray(response))) {
//         setDepartments(Array.isArray(response.data) ? response.data : response);
//       }
//     } catch (error) {
//       console.error("Error fetching departments:", error);
//     }
//   };

//   useEffect(() => {
//     fetchDepartments();
//   }, []);

//   const filteredRequests = requests
//     .filter((request) => {
//       const searchLower = searchTerm.toLowerCase();
//       const matchesSearch =
//         !searchTerm ||
//         request.visitorName.toLowerCase().includes(searchLower) ||
//         request.visitorId.toLowerCase().includes(searchLower) ||
//         request.badgeNumber.toLowerCase().includes(searchLower) ||
//         request.telephone?.toLowerCase().includes(searchLower);

//       let normalizedStatus = request.status.replace("_", "-");
//       if (normalizedStatus === "transfered") normalizedStatus = "transferred";
//       const matchesStatus =
//         statusFilter === "all" ||
//         normalizedStatus === statusFilter.toLowerCase();

//       return matchesSearch && matchesStatus;
//     })
//     .sort((a, b) => {
//       const statusOrder: Record<string, number> = {
//         inprogress: 1,
//         transfered: 2,
//         transferred: 2,
//         "Not started": 3,
//         "not-started": 3,
//         completed: 4,
//       };
//       const orderA = statusOrder[a.status] ?? 99;
//       const orderB = statusOrder[b.status] ?? 99;
//       return orderA - orderB;
//     });

//   const updateBackendStatus = async (
//     targetStatus: string,
//     visitorId: string,
//     rawVisitor: any,
//     isStart: boolean = false,
//     durationStr: string = "",
//     notes: string = "",
//   ) => {
//     const currentUser = user as any;
//     const myId = String(
//       currentUser?.userId ||
//         currentUser?._id ||
//         currentUser?.id ||
//         currentUser?.employee_id ||
//         "",
//     );
//     const myName = String(
//       currentUser?.full_name ||
//         currentUser?.fullName ||
//         currentUser?.name ||
//         "Unknown",
//     );

//     // Try to find exact assignment first
//     let deptInfo = rawVisitor.departments_assigned?.find(
//       (d: any) => String(d.provider_id) === myId,
//     );

//     // If no exact assignment, find the unit assignment
//     if (!deptInfo) {
//       deptInfo = rawVisitor.departments_assigned?.find((d: any) => {
//         return String(d.department_id) === String(currentUser?.department_id);
//       });
//     }

//     await serviceDeliveryService.updateServiceStatus({
//       visitor_id: visitorId,
//       status: targetStatus,
//       notes: notes
//     });
//   };

//   const handleTransferVisitor = async () => {
//     if (!transferVisitor || !transferDepartment) return;
//     setTransferring(true);
//     try {
//       const currentUser = user as any;
//       const myId = String(
//         currentUser?.userId ||
//           currentUser?._id ||
//           currentUser?.id ||
//           currentUser?.employee_id ||
//           "",
//       );

//       // Determine target: unit if selected, else department
//       const targetId = selectedUnit || transferDepartment;
//       const targetInfo = selectedUnit
//         ? units.find((u) => u.id === selectedUnit)
//         : departments.find((d) => d._id === transferDepartment);
//       const targetName = targetInfo?.name || targetInfo?.department_name || "Unknown";

//       const currentDept = transferVisitor.rawVisitor?.departments_assigned?.find(
//         (d: any) => String(d.provider_id) === myId,
//       );
//       const previousDepartmentId = currentDept?.department_id;

//       // Only assign specific provider if employee selected
//       const providerId = transferEmployee
//         ? String(transferEmployee._id || transferEmployee.employee_id || "")
//         : undefined;
//       const providerName = transferEmployee
//         ? String(transferEmployee.full_name || "")
//         : undefined;

//       setRequests((prev) =>
//         prev.map((r) =>
//           r.id === transferVisitor.id
//             ? {
//                 ...r,
//                 status: "transfered",
//                 assignedTo: providerName || `${targetName}` || "Transferred",
//               }
//             : r,
//         ),
//       );

//       await serviceDeliveryService.assignToDepartment(
//         transferVisitor.id,
//         targetId,
//         targetName,
//         providerId,
//         providerName,
//         previousDepartmentId,
//       );

//       setShowTransferModal(false);
//       setTransferVisitor(null);
//       setTransferDepartment("");
//       setTransferEmployee(null);
//       setTransferEmployees([]);
//       setUnits([]);
//       setSelectedUnit("");

//       fetchAssignedVisitors(true);
//     } catch (error) {
//       console.error("Error transferring visitor:", error);
//       alert("Failed to transfer visitor. Please try again.");
//       fetchAssignedVisitors(true);
//     } finally {
//       setTransferring(false);
//     }
//   };

//   const fetchTransferEmployees = async (deptId: string) => {
//     if (!deptId) {
//       setTransferEmployees([]);
//       return;
//     }
//     setTransferEmployeesLoading(true);
//     try {
//       const response = (await employeeService.getByDepartment(
//         deptId,
//         false,
//       )) as any;
//       if (response && (response.data || Array.isArray(response))) {
//         setTransferEmployees(
//           Array.isArray(response.data) ? response.data : response,
//         );
//       }
//     } catch (error) {
//       console.error("Error fetching employees:", error);
//       setTransferEmployees([]);
//     } finally {
//       setTransferEmployeesLoading(false);
//     }
//   };

//   const loadUnitsByDepartment = async (departmentId: string) => {
//     setTransferEmployeesLoading(true);
//     try {
//       const response = await departmentService.getAll();
//       if (response.status || response.success) {
//         const deptData = Array.isArray(response.data) ? response.data : [];

//         const subDepts = deptData.filter((dept: any) => {
//           return (
//             (dept.sub_department_mng?.is_sub_department === true ||
//               dept.sub_department_mng?.is_sub_department === "true") &&
//             String(dept.sub_department_mng?.parent_department_id) ===
//               String(departmentId)
//           );
//         });

//         const formattedUnits = subDepts.map((subDept: any) => ({
//           id: subDept._id || subDept.department_id,
//           name: subDept.department_name || subDept.name,
//           staffAvailable: subDept.total_employees || 0,
//           currentQueue: 0,
//           isActive: true,
//         }));

//         setUnits(formattedUnits);
//       } else {
//         setUnits([]);
//       }
//     } catch (error) {
//       console.error("Failed to load units:", error);
//       setUnits([]);
//     } finally {
//       setTransferEmployeesLoading(false);
//     }
//   };

//   // ===== NEW: Handler for clicking on visitor to view details =====
//   const handleVisitorClick = (request: ServiceRequest) => {
//     console.log("[DEBUG] handleVisitorClick called with:", request.visitorName);
//     setDetailsVisitor(request);
//     setShowVisitorDetails(true);
//     console.log("[DEBUG] showVisitorDetails set to true");
//   };

//   // ===== MODIFIED: Handle Transfer Click - Close details popup first =====
//   const handleTransferClick = (request: ServiceRequest) => {
//     // Close details popup if open before opening transfer modal
//     setShowVisitorDetails(false);
//     setDetailsVisitor(null);
//     if (request.status === "completed") return;
//     setTransferVisitor(request);
//     setTransferDepartment("");
//     setTransferEmployee(null);
//     setTransferEmployees([]);
//     setUnits([]);
//     setSelectedUnit("");
//     setShowTransferModal(true);
//   };

//   const handleTransferDepartmentChange = (deptId: string) => {
//     setTransferDepartment(deptId);
//     setTransferEmployee(null);
//     setSelectedUnit("");
//     if (deptId) {
//       loadUnitsByDepartment(deptId);
//       fetchTransferEmployees(deptId);
//     } else {
//       setUnits([]);
//       setTransferEmployees([]);
//     }
//   };

//   const handleServeClick = async (request: ServiceRequest) => {
//     if (request.status === "completed") return;

//     let currentStatus = request.status;
//     let startTime = request.serviceStartTime;

//     if (request.status === "Not started" || request.status === "transfered") {
//       currentStatus = "inprogress";
//       startTime = new Date().toISOString();

//       setRequests((prev) =>
//         prev.map((r) =>
//           r.id === request.id
//             ? { ...r, status: "inprogress", serviceStartTime: startTime }
//             : r,
//         ),
//       );

//       await updateBackendStatus(
//         "Inprogress",
//         request.id,
//         request.rawVisitor,
//         true,
//       );
//       fetchAssignedVisitors(true);
//     }

//     setSelectedVisitor({
//       id: request.id,
//       name: request.visitorName,
//       visitorId: request.visitorId,
//       badgeNumber: request.badgeNumber,
//       email: request.telephone,
//       service: request.serviceType,
//       checkInTime: request.checkInRaw
//         ? new Date(request.checkInRaw).toLocaleTimeString("en-US", {
//             hour: "2-digit",
//             minute: "2-digit",
//           })
//         : "N/A",
//       gate: "Main Reception",
//       status: currentStatus,
//       serviceStartTime: startTime,
//       rawVisitor: request.rawVisitor,
//     });

//     setShowModal(true);
//   };

//   const handleServiceComplete = async (data: any) => {
//     if (!selectedVisitor) return;
//     setIsServing(true);

//     try {
//       const isTransfer =
//         data.notes && data.notes.toLowerCase().includes("transfer");
//       const targetStatus = isTransfer ? "Transfered" : "Completed";

//       setRequests((prev) =>
//         prev.map((r) =>
//           r.id === selectedVisitor.id
//             ? { ...r, status: targetStatus as any }
//             : r,
//         ),
//       );

//       await updateBackendStatus(
//         targetStatus,
//         selectedVisitor.id,
//         selectedVisitor.rawVisitor,
//         false,
//         data.duration,
//         data.notes,
//       );

//       setShowModal(false);
//       setSelectedVisitor(null);
//       fetchAssignedVisitors(true);
//     } catch (error) {
//       console.error("Failed to process service:", error);
//       alert("Failed to process request. Please try again.");
//     } finally {
//       setIsServing(false);
//     }
//   };

//   return (
//     <div className={isDashboardView ? "" : "p-7"}>
//       {!isDashboardView && (
//         <>
//           <div className="flex justify-between items-start">
//             <div>
//               <h1 className="text-[#1a2744] text-[32px] font-extrabold">
//                 Service Provision
//               </h1>
//               <p className="text-[#888] text-[13px] mt-1.5">
//                 Manage active visitor requests, track wait times, and provision
//                 services efficiently.
//               </p>
//             </div>
//             <button
//               onClick={() => fetchAssignedVisitors(false)}
//               className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50 transition-colors"
//             >
//               <FiRefreshCw
//                 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
//               />{" "}
//               Refresh Data
//             </button>
//           </div>

//           <div className="flex gap-5 mt-7">
//             <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
//               <div className="flex justify-between items-start">
//                 <span className="text-[#999] text-[11px] uppercase tracking-wider">
//                   AVG. SERVICE TIME
//                 </span>
//                 <FiClock className="text-[#90a4ae] w-7 h-7" />
//               </div>
//               <div className="text-[#1a2744] text-[28px] font-bold mt-3">
//                 {stats.waitAvg}
//               </div>
//             </div>
//             <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
//               <div className="flex justify-between items-start">
//                 <span className="text-[#999] text-[11px] uppercase tracking-wider">
//                   WAITING VISITORS
//                 </span>
//                 <div className="text-[#90a4ae]">
//                   <svg
//                     width="28"
//                     height="28"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     strokeWidth="2"
//                   >
//                     <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
//                     <circle cx="9" cy="7" r="4" />
//                     <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
//                     <path d="M16 3.13a4 4 0 0 1 0 7.75" />
//                   </svg>
//                 </div>
//               </div>
//               <div className="text-[#1a2744] text-[28px] font-bold mt-3">
//                 {stats.waiting}
//               </div>
//             </div>
//             <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
//               <div className="flex justify-between items-start">
//                 <span className="text-[#999] text-[11px] uppercase tracking-wider">
//                   COMPLETED TODAY
//                 </span>
//                 <FiCheckCircle className="text-[#34a853] w-7 h-7" />
//               </div>
//               <div className="text-[#1a2744] text-[28px] font-bold mt-3">
//                 {stats.completed}
//               </div>
//             </div>
//           </div>
//         </>
//       )}

//       <div
//         className={`bg-white rounded-[14px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] ${!isDashboardView ? "mt-6" : ""}`}
//       >
//         <div className="flex items-center gap-3">
//           <div className="flex">
//             <div className="flex-1 relative">
//               <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
//               <input
//                 type="text"
//                 placeholder="Search by visitor name, ID, or badge..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-l-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8]"
//               />
//             </div>
//             <button
//               onClick={() => {
//                 setCurrentPage(1);
//                 fetchAssignedVisitors(false, 1, searchTerm);
//               }}
//               disabled={loading}
//               className="px-4 py-2 bg-[#1a73e8] text-white rounded-r-[8px] hover:bg-[#1557b0] focus:ring-2 focus:ring-[#1a73e8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-11"
//             >
//               {loading && searchTerm ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : null}
//               {loading && searchTerm ? 'Searching...' : 'Search'}
//             </button>
//           </div>
//           <select
//             value={statusFilter}
//             onChange={(e) => {
//               setStatusFilter(e.target.value);
//               setCurrentPage(1);
//             }}
//             className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8] bg-white"
//           >
//             <option value="all">All Status</option>
//             <option value="not-started">Not Started</option>
//             <option value="inprogress">In Progress</option>
//             <option value="completed">Completed</option>
//           </select>
//           {isDashboardView && (
//             <button
//               onClick={() => fetchAssignedVisitors(false)}
//               className="flex items-center gap-2 h-11 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50"
//             >
//               <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
//             </button>
//           )}
//         </div>
//       </div>

//       <div className="bg-white rounded-[14px] p-6 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-x-auto">
//         <table className="w-full min-w-[800px]">
//           <thead>
//             <tr className="border-b border-[#f0f0f0]">
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[25%]">
//                 VISITOR
//               </th>
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[20%]">
//                 BADGE & ID
//               </th>
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
//                 ASSIGNED TO
//               </th>
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
//                 WAIT TIME
//               </th>
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
//                 STATUS
//               </th>
//               <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[10%]">
//                 ACTION
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading && requests.length === 0 ? (
//               <tr>
//                 <td colSpan={6} className="py-8 text-center text-gray-500">
//                   Loading requests...
//                 </td>
//               </tr>
//             ) : requests.length > 0 ? (
//               requests.map((request) => (
//                 <tr key={request.id} className="border-b border-[#f8f8f8] h-14">
//                   <td className="py-3 px-2">
//                     <div className="flex items-center gap-3">
//                       <div
//                         className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}
//                       >
//                         {request.initials}
//                       </div>
//                       <div className="min-w-0 flex-1">
//                         {/* ===== MODIFICATION: Made visitor name clickable to show details popup ===== */}
//                         <div 
//                           className="text-[#333] text-[13px] font-medium truncate cursor-pointer hover:text-[#1a73e8] hover:underline inline-flex items-center gap-2"
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             console.log("[CLICK] Visitor name clicked:", request.visitorName);
//                             handleVisitorClick(request);
//                           }}
//                           title="Click to view visitor details"
//                         >
//                           {request.visitorName}
//                           {/* ===== ADDED: Info icon for better visibility ===== */}
//                           <span className="inline-block w-4 h-4 text-gray-400" title="Click for details">
//                             <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                             </svg>
//                           </span>
//                         </div>
//                         <div className="text-[#888] text-[11px] truncate">
//                           {request.telephone !== "____"
//                             ? request.telephone
//                             : "No phone"}
//                         </div>
//                       </div>
//                     </div>
//                   </td>

//                   <td className="py-3 px-2">
//                     <div className="text-[#333] text-[13px] font-medium">
//                       {request.badgeNumber
//                         ? `Badge: ${request.badgeNumber}`
//                         : "No Badge"}
//                     </div>
//                     <div className="text-[#888] text-[11px]">
//                       ID: {request.visitorId}
//                     </div>
//                   </td>

//                   <td className="py-3 px-2 text-[#333] text-[13px] font-medium">
//                     {request.assignedTo}
//                   </td>
//                   <td className="py-3 px-2 text-[#666] text-[13px] font-medium">
//                     {request.waitTime}
//                   </td>
//                   <td className="py-3 px-2">
//                     {request.status === "Not started" && (
//                       <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#fff3e0] text-[#f57c00]">
//                         Not Started
//                       </span>
//                     )}
//                     {request.status === "inprogress" && (
//                       <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e3f2fd] text-[#1a73e8]">
//                         <FiClock className="w-3 h-3 animate-pulse" />
//                         <LiveTimer startTime={request.serviceStartTime} />
//                       </span>
//                     )}
//                     {request.status === "completed" && (
//                       <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e8f5e9] text-[#2e7d32]">
//                         Completed
//                       </span>
//                     )}
//                     {request.status === "transfered" && (
//                       <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#f3e5f5] text-[#7b1fa2]">
//                         Transferred
//                       </span>
//                     )}
//                   </td>
//                   <td className="py-3 px-2">
//                     {request.status === "completed" ? (
//                       <span className="text-[#34a853] text-[12px] font-medium">
//                         ✓ Served
//                       </span>
//                     ) : request.not_transferred_to_me === true ? (
//                       <span className="text-[#7b1fa2] text-[12px] font-medium">
//                         ⇄ Transferred Away
//                       </span>
//                     ) : request.status === "inprogress" ? (
//                       <div className="flex items-center gap-2">
//                         <button
//                           onClick={() => handleServeClick(request)}
//                           disabled={isServing}
//                           className="h-8 w-20 bg-[#e53935] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
//                         >
//                           <FiSquare className="w-3 h-3 fill-current" /> Stop
//                         </button>
//                       </div>
//                     ) : (
//                       <div className="flex items-center gap-2">
//                         <button
//                           onClick={() => handleServeClick(request)}
//                           disabled={isServing}
//                           className="h-8 w-16 bg-[#1a73e8] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1558c0] transition-colors disabled:opacity-50"
//                         >
//                           Serve
//                         </button>
//                         <button
//                           onClick={() => handleTransferClick(request)}
//                           disabled={isServing}
//                           className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
//                         >
//                           <FiArrowRightCircle className="w-3 h-3" /> Transfer
//                         </button>
//                       </div>
//                     )}

//                     {request.not_transferred_to_me === true && (
//                       <div className="flex items-center gap-2">
//                         <button
//                           onClick={() => handleTransferClick(request)}
//                           disabled={isServing}
//                           className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
//                         >
//                           <FiArrowRightCircle className="w-3 h-3" /> Transfer
//                         </button>
//                       </div>
//                     )}
//                   </td>
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td colSpan={7} className="text-center py-8 text-gray-500">
//                   {searchTerm ? "No visitors found matching your search." : "No visitors found for your department."}
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>

//         {totalCount > 0 && (
//           // ===== MODIFICATION: Updated pagination to match receptionist dashboard style =====
//           <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
//             <p className="text-xs text-gray-600">
//               Showing{" "}
//               {requests.length > 0
//                 ? (currentPage - 1) * 20 + 1
//                 : 0}{" "}
//               to {Math.min(currentPage * 20, totalCount)} of{" "}
//               {totalCount} results
//             </p>
//             <div className="flex gap-2">
//               <button
//                 onClick={() => {
//                   const newPage = Math.max(1, currentPage - 1);
//                   setCurrentPage(newPage);
//                   fetchAssignedVisitors(false, newPage, searchTerm);
//                 }}
//                 disabled={currentPage === 1}
//                 className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
//               >
//                 Previous
//               </button>
//               <span className="text-sm text-gray-600 py-1 px-3">
//                 Page {currentPage} of {totalPages || 1}
//               </span>
//               <button
//                 onClick={() => {
//                   const newPage = Math.min(totalPages, currentPage + 1);
//                   setCurrentPage(newPage);
//                   fetchAssignedVisitors(false, newPage, searchTerm);
//                 }}
//                 disabled={currentPage === totalPages || totalPages === 0}
//                 className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
//               >
//                 Next
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       <ServeVisitorModal
//         isOpen={showModal}
//         onClose={() => {
//           setShowModal(false);
//           setSelectedVisitor(null);
//         }}
//         visitor={selectedVisitor as any}
//         onServiceEnd={handleServiceComplete}
//       />

//       {/* Transfer Modal */}
//       {showTransferModal && transferVisitor && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-md overflow-hidden">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-6">
//                 <h2 className="text-[#2C3E50] text-[20px] font-semibold">
//                   Transfer Visitor
//                 </h2>
//                 <button
//                   onClick={() => {
//                     setShowTransferModal(false);
//                     setTransferVisitor(null);
//                     setTransferDepartment("");
//                     setTransferEmployee(null);
//                     setTransferEmployees([]);
//                     setUnits([]);
//                     setSelectedUnit("");
//                   }}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <FiX className="w-6 h-6" />
//                 </button>
//               </div>

//               <div className="mb-4">
//                 <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
//                   Visitor
//                 </label>
//                 <div className="flex items-center gap-3 p-3 bg-[#F7F9FB] rounded-lg">
//                   <div
//                     className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${transferVisitor.avatarColor}`}
//                   >
//                     <span>{transferVisitor.initials}</span>
//                   </div>
//                   <div>
//                     <div className="text-[#2C3E50] text-[14px] font-medium">
//                       {transferVisitor.visitorName}
//                     </div>
//                     <div className="text-[#8A94A6] text-[12px]">
//                       Badge: {transferVisitor.badgeNumber || "N/A"}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="mb-4">
//                 <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
//                   Select Department
//                 </label>
//                 <select
//                   value={transferDepartment}
//                   onChange={(e) => handleTransferDepartmentChange(e.target.value)}
//                   className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white"
//                 >
//                   <option value="">Choose department...</option>
//                   {departments.map((dept) => (
//                     <option key={dept._id} value={dept._id}>
//                       {dept.department_name || dept.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {transferDepartment && (
//                 <div className="mb-4">
//                   <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
//                     Select Unit (Optional)
//                   </label>
//                   <select
//                     value={selectedUnit}
//                     onChange={(e) => setSelectedUnit(e.target.value)}
//                     className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white"
//                   >
//                     <option value="">No specific unit</option>
//                     {units.map((unit) => (
//                       <option key={unit.id} value={unit.id}>
//                         {unit.name}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//               )}

//               {transferDepartment && (
//                 <div className="mb-6">
//                   <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
//                     Assign to Specific Employee (Optional)
//                   </label>
//                   <div className="relative">
//                     <select
//                       value={
//                         transferEmployee?._id ||
//                         transferEmployee?.employee_id ||
//                         ""
//                       }
//                       onChange={(e) => {
//                         const emp = transferEmployees.find(
//                           (em) =>
//                             String(em._id || em.employee_id) ===
//                             e.target.value,
//                         );
//                         setTransferEmployee(emp || null);
//                       }}
//                       className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white cursor-pointer appearance-none"
//                       disabled={transferEmployeesLoading}
//                     >
//                       <option value="">Any employee in department/unit</option>
//                       {transferEmployees.map((emp) => {
//                         const empId = String(
//                           emp._id || emp.employee_id || "",
//                         );
//                         return (
//                           <option key={empId} value={empId}>
//                             {emp.full_name}{" "}
//                             {emp.title ? `(${emp.title})` : ""}
//                           </option>
//                         );
//                       })}
//                     </select>
//                     {!transferEmployeesLoading && (
//                       <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
//                         <svg
//                           className="w-4 h-4 text-gray-400"
//                           fill="none"
//                           stroke="currentColor"
//                           viewBox="0 0 24 24"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M19 9l-7 7-7-7"
//                           />
//                         </svg>
//                       </div>
//                     )}
//                   </div>
//                   {transferEmployeesLoading && (
//                     <div className="text-xs text-gray-500 mt-1">
//                       Loading employees...
//                     </div>
//                   )}
//                 </div>
//               )}

//               <div className="flex gap-3">
//                 <button
//                   onClick={() => {
//                     setShowTransferModal(false);
//                     setTransferVisitor(null);
//                     setTransferDepartment("");
//                     setTransferEmployee(null);
//                     setTransferEmployees([]);
//                     setUnits([]);
//                     setSelectedUnit("");
//                   }}
//                   className="flex-1 px-4 py-2 border border-[#D9E1EA] text-[#2C3E50] rounded-[8px] font-medium hover:bg-gray-50 transition-colors"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={handleTransferVisitor}
//                   disabled={!transferDepartment || transferring}
//                   className="flex-1 px-4 py-2 bg-[#0284C7] text-white rounded-[8px] font-medium hover:bg-[#0369A1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
//                 >
//                   {transferring ? (
//                     <>
//                       <FiRefreshCw className="w-4 h-4 animate-spin" />
//                       Transferring...
//                     </>
//                   ) : (
//                     "Transfer Visitor"
//                   )}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ===== NEW FEATURE: Visitor Details Popup Modal ===== */}
//       {/* This modal shows when clicking on visitor name to display details and actions */}
//       {showVisitorDetails && detailsVisitor && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-lg overflow-hidden">
//             {/* Modal Header */}
//             <div className="p-6 border-b border-gray-100">
//               <div className="flex justify-between items-center">
//                 <h2 className="text-[#2C3E50] text-[20px] font-semibold">
//                   Visitor Details
//                 </h2>
//                 <button
//                   onClick={() => {
//                     setShowVisitorDetails(false);
//                     setDetailsVisitor(null);
//                   }}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <FiX className="w-6 h-6" />
//                 </button>
//               </div>
//             </div>

//             {/* Modal Body - Visitor Information */}
//             <div className="p-6">
//               {/* Visitor Basic Info */}
//               <div className="flex items-center gap-4 mb-6">
//                 <div
//                   className={`w-14 h-14 rounded-full ${detailsVisitor.avatarColor} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}
//                 >
//                   {detailsVisitor.initials}
//                 </div>
//                 <div>
//                   <div className="text-[#2C3E50] text-[18px] font-semibold">
//                     {detailsVisitor.visitorName}
//                   </div>
//                   <div className="text-[#8A94A6] text-[13px]">
//                     {detailsVisitor.telephone !== "____" ? detailsVisitor.telephone : "No phone"}
//                   </div>
//                 </div>
//               </div>

//               {/* Visitor Details Grid */}
//               <div className="grid grid-cols-2 gap-4 mb-6">
//                 {/* Badge Number */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Badge Number
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.badgeNumber || "N/A"}
//                   </div>
//                 </div>

//                 {/* Visitor ID */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Visitor ID
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.visitorId}
//                   </div>
//                 </div>

//                 {/* ===== NEW: Unity Assigned by Receptionist ===== */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Unity (Receptionist)
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.rawVisitor?.departments_assigned?.[0]?.department_name || 
//                      detailsVisitor.rawVisitor?._departmentGroup || 
//                      "General Service"}
//                   </div>
//                 </div>

//                 {/* Assigned To (Current Provider) */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Assigned To
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.assignedTo}
//                   </div>
//                 </div>

//                 {/* Wait Time */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Wait Time
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.waitTime}
//                   </div>
//                 </div>

//                 {/* Status */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Status
//                   </div>
//                   <div className="text-[14px] font-medium">
//                     {detailsVisitor.status === "Not started" && (
//                       <span className="text-[#f57c00]">Not Started</span>
//                     )}
//                     {detailsVisitor.status === "inprogress" && (
//                       <span className="text-[#1a73e8] flex items-center gap-1">
//                         <FiClock className="w-3 h-3 animate-pulse" />
//                         In Progress
//                       </span>
//                     )}
//                     {detailsVisitor.status === "completed" && (
//                       <span className="text-[#2e7d32]">Completed</span>
//                     )}
//                     {detailsVisitor.status === "transfered" && (
//                       <span className="text-[#7b1fa2]">Transferred</span>
//                     )}
//                   </div>
//                 </div>

//                 {/* Check-in Time */}
//                 <div className="bg-[#F7F9FB] rounded-lg p-3 col-span-2">
//                   <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
//                     Check-in Time
//                   </div>
//                   <div className="text-[#2C3E50] text-[14px] font-medium">
//                     {detailsVisitor.checkInRaw 
//                       ? new Date(detailsVisitor.checkInRaw).toLocaleString("en-US", {
//                           year: "numeric",
//                           month: "short",
//                           day: "numeric",
//                           hour: "2-digit",
//                           minute: "2-digit",
//                         })
//                       : "N/A"}
//                   </div>
//                 </div>
//               </div>

//               {/* ===== NEW: Action Buttons in Popup ===== */}
//               {/* Serve and Transfer buttons in the visitor details popup */}
//               <div className="flex gap-3 mt-6">
//                 {detailsVisitor.status === "completed" ? (
//                   <div className="flex-1 px-4 py-3 bg-[#e8f5e9] text-[#2e7d32] rounded-[8px] font-medium text-center">
//                     ✓ Service Completed
//                   </div>
//                 ) : detailsVisitor.status === "inprogress" ? (
//                   <>
//                     <button
//                       onClick={() => {
//                         setShowVisitorDetails(false);
//                         handleServeClick(detailsVisitor);
//                       }}
//                       disabled={isServing}
//                       className="flex-1 px-4 py-3 bg-[#e53935] text-white rounded-[8px] font-medium hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//                     >
//                       <FiSquare className="w-4 h-4 fill-current" />
//                       Stop Service
//                     </button>
//                     <button
//                       onClick={() => handleTransferClick(detailsVisitor)}
//                       disabled={isServing}
//                       className="flex-1 px-4 py-3 bg-[#7b1fa2] text-white rounded-[8px] font-medium hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//                     >
//                       <FiArrowRightCircle className="w-4 h-4" />
//                       Transfer
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     <button
//                       onClick={() => {
//                         setShowVisitorDetails(false);
//                         handleServeClick(detailsVisitor);
//                       }}
//                       disabled={isServing}
//                       className="flex-1 px-4 py-3 bg-[#1a73e8] text-white rounded-[8px] font-medium hover:bg-[#1558c0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//                     >
//                       <FiCheckCircle className="w-4 h-4" />
//                       Serve
//                     </button>
//                     <button
//                       onClick={() => handleTransferClick(detailsVisitor)}
//                       disabled={isServing}
//                       className="flex-1 px-4 py-3 bg-[#7b1fa2] text-white rounded-[8px] font-medium hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
//                     >
//                       <FiArrowRightCircle className="w-4 h-4" />
//                       Transfer
//                     </button>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProvideServicesTab;



// ProvideServicesTab - Service Provision page with Serve Modal
// NOW REUSABLE: Can be embedded in the Dashboard or viewed standalone.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiClock,
  FiCheckCircle,
  FiRefreshCw,
  FiSquare,
  FiArrowRightCircle,
  FiX,
  FiUser,
  FiLoader,
} from "react-icons/fi";

// ===== MODIFICATION: Import icons for new pagination buttons =====
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useToast } from "../../../../../core/contexts/ToastContext";
import Table from "../../../../../core/components/Table";
import type { TableHeader, TablePagination } from "../../../../../core/components/Table";

// ===== NEW: SearchableSelect Component =====
interface SearchableSelectProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  emptyMessage?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  icon,
  emptyMessage = "No options found"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayText, setDisplayText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);
  
  useEffect(() => {
    if (selectedOption) {
      setDisplayText(selectedOption.name);
    } else {
      setDisplayText("");
    }
  }, [selectedOption]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-sm bg-gray-100 text-gray-500 cursor-not-allowed flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        <span>{placeholder}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full z-[50]">
      <div 
        className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-sm bg-white cursor-text focus-within:ring-2 focus-within:ring-[#0284C7] focus-within:border-[#0284C7] focus-within:bg-blue-50"
        onClick={() => !isOpen && inputRef.current?.focus()}
      >
        <div className="flex items-center">
          {icon && <span className="mr-2 text-[#0284C7]"><FiSearch className="w-4 h-4" /></span>}
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayText}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={value ? '' : placeholder}
            className="flex-1 outline-none bg-transparent text-[#2C3E50] placeholder-gray-400 text-[13px] w-full"
            disabled={disabled}
          />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border-2 border-[#0284C7] rounded-[8px] shadow-2xl max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-gray-500 text-center italic">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map(option => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-[#e8f4fe] text-[#2C3E50] text-[13px] border-b border-gray-100 ${
                  option.id === value ? 'bg-[#0284C7] text-white font-medium' : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                {option.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
// ============================================

import { ServeVisitorModal } from "../index";
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
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] =
    useState<SelectedVisitor | null>(null);
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [detailsVisitor, setDetailsVisitor] =
    useState<ServiceRequest | null>(null);

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



  const fetchAssignedVisitors = useCallback(
    async (silent: boolean = false, page: number = currentPage, query: string = searchTerm) => {
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
        let response;
        if (query && query.trim()) {
          response = await serviceDeliveryService.search(query, page, 20);
        } else {
          response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, 20);
        }

        if (response && response.success) {
          const allVisitors: any[] = response.data || [];

          setTotalCount(response.total || 0);
          setTotalPages(Math.ceil((response.total || 0) / 20));

          const formattedRequests = allVisitors.map((v: any) => {
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

            // Find assignment for current provider
            const myAssignment = v.departments_assigned?.find(
              (d: any) => String(d.provider_id) === myId
            );

            const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();

            // Find service duration for current provider
            const serviceDuration = v.durations?.services_durations?.find(
              (d: any) => String(d.provider_id) === myId && d.ended_at === null,
            );
            const serviceStartTimeVal = serviceDuration?.started_at || "";

            // Find service status
            let myServiceStatus = null;
            if (Array.isArray(v.services_status)) {
              myServiceStatus = v.services_status.find(
                (s: any) => String(s.provider_id) === myId
              );
            } else if (v.services_status && typeof v.services_status === "object") {
              if (String(v.services_status.provider_id) === myId) {
                myServiceStatus = v.services_status;
              }
            }

            let status = (myServiceStatus?.s_type || v.status || "Not started").toLowerCase();
            if (status === "not started") status = "Not started";
            if (status === "inprogress") status = "inprogress";
            if (status === "completed") status = "completed";
            if (status === "transfered" || status === "transferred") status = "transfered";

            const waitTimeEndStamp = 
              (status === "inprogress" || status === "completed" || status === "transfered") && serviceStartTimeVal
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
                waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
              }
            }

            const assignedToDisplay = myAssignment?.provider_name || myAssignment?.department_name || "Unassigned";

            return {
              id: v._id || v.id,
              visitorName: visitorName,
              visitorId: identification,
              badgeNumber: badgeNumber,
              assignedTo: assignedToDisplay,
              serviceType: myAssignment?.department_name || v._departmentGroup || "General Service",
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
                  myServiceStatus.s_type?.toLowerCase() === "transferred"
                : false,
            };
          });

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
    [user, currentPage, searchTerm],
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

      let normalizedStatus = request.status.replace(/[\s_]+/g, "-").toLowerCase();
      if (normalizedStatus === "transfered") normalizedStatus = "transferred";
      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const getStatusKey = (status: string) => status.replace(/[\s_]+/g, "-").toLowerCase();
      const statusOrder: Record<string, number> = {
        inprogress: 1,
        transfered: 2,
        transferred: 2,
        "not-started": 3,
        completed: 4,
      };
      const orderA = statusOrder[getStatusKey(a.status)] ?? 99;
      const orderB = statusOrder[getStatusKey(b.status)] ?? 99;
      return orderA - orderB;
    });

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

    // Try to find exact assignment first
    let deptInfo = rawVisitor.departments_assigned?.find(
      (d: any) => String(d.provider_id) === myId,
    );

    // If no exact assignment, find the unit assignment
    if (!deptInfo) {
      deptInfo = rawVisitor.departments_assigned?.find((d: any) => {
        return String(d.department_id) === String(currentUser?.department_id);
      });
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

      // Determine target: unit if selected, else department
      const targetId = selectedUnit || transferDepartment;
      const targetInfo = selectedUnit
        ? units.find((u) => u.id === selectedUnit)
        : departments.find((d) => d._id === transferDepartment);
      const targetName = targetInfo?.name || targetInfo?.department_name || "Unknown";

      const currentDept = transferVisitor.rawVisitor?.departments_assigned?.find(
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
                assignedTo: providerName || `${targetName}` || "Transferred",
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

  const handleVisitorClick = (request: ServiceRequest) => {
    console.log("[DEBUG] handleVisitorClick called with:", request.visitorName);
    setDetailsVisitor(request);
    setShowVisitorDetails(true);
  };



  const handleTransferClick = (request: ServiceRequest) => {
    // Close details popup if open before opening transfer modal
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
      fetchTransferEmployees(deptId);
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
          <div className="flex">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by visitor name, ID, or badge..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-l-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
            <button
              onClick={() => {
                setCurrentPage(1);
                fetchAssignedVisitors(false, 1, searchTerm);
              }}
              disabled={loading}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-r-[8px] hover:bg-[#1557b0] focus:ring-2 focus:ring-[#1a73e8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-11"
            >
              {loading && searchTerm ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : null}
              {loading && searchTerm ? 'Searching...' : 'Search'}
            </button>
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
        <Table
          headers={[
            { key: 'visitor', label: 'VISITOR' },
            { key: 'badge_id', label: 'BADGE & ID' },
            { key: 'assigned_to', label: 'ASSIGNED TO' },
            { key: 'wait_time', label: 'WAIT TIME' },
            { key: 'status', label: 'STATUS' },
            { key: 'action', label: 'ACTION' }
          ]}
          data={filteredRequests}
          loading={loading && requests.length === 0}
          emptyMessage={searchTerm ? "No visitors found matching your search." : "No visitors found for your department."}
          maxHeight="500px"
          minWidth="1000px"
          onRowClick={(request) => handleVisitorClick(request)}
          renderCell={(header, request) => {
            switch (header.key) {
              case 'visitor':
                return (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}
                    >
                      {request.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[#333] text-[13px] font-medium truncate"
                        title="Click row to view visitor details"
                      >
                        {request.visitorName}
                      </div>
                      <div className="text-[#888] text-[11px] truncate">
                        {request.telephone !== "____"
                          ? request.telephone
                          : "No phone"}
                      </div>
                    </div>
                  </div>
                );
              case 'badge_id':
                return (
                  <div>
                    <div className="text-[#333] text-[13px] font-medium">
                      {request.badgeNumber
                        ? `Badge: ${request.badgeNumber}`
                        : "No Badge"}
                    </div>
                    <div className="text-[#888] text-[11px]">
                      ID: {request.visitorId}
                    </div>
                  </div>
                );
              case 'assigned_to':
                return <span className="text-[#333] text-[13px] font-medium">{request.assignedTo}</span>;
              case 'wait_time':
                return <span className="text-[#666] text-[13px] font-medium">{request.waitTime}</span>;
              case 'status':
                if (request.status === "Not started") {
                  return (
                    <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#fff3e0] text-[#f57c00]">
                      Not Started
                    </span>
                  );
                }
                if (request.status === "inprogress") {
                  return (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e3f2fd] text-[#1a73e8]">
                      <FiClock className="w-3 h-3 animate-pulse" />
                      <LiveTimer startTime={request.serviceStartTime} />
                    </span>
                  );
                }
                if (request.status === "completed") {
                  return (
                    <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e8f5e9] text-[#2e7d32]">
                      Completed
                    </span>
                  );
                }
                if (request.status === "transfered") {
                  return (
                    <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#f3e5f5] text-[#7b1fa2]">
                      Transferred
                    </span>
                  );
                }
                return <span>{request.status || '-'}</span>;
              case 'action':
                if (request.status === "completed") {
                  return (
                    <span className="text-[#34a853] text-[12px] font-medium">
                      ✓ Served
                    </span>
                  );
                }
                if (request.not_transferred_to_me === true) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-[#7b1fa2] text-[12px] font-medium">
                        ⇄ Transferred Away
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTransferClick(request);
                        }}
                        disabled={isServing}
                        className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <FiArrowRightCircle className="w-3 h-3" /> Transfer
                      </button>
                    </div>
                  );
                }
                if (request.status === "inprogress") {
                  return (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServeClick(request);
                        }}
                        disabled={isServing}
                        className="h-8 w-20 bg-[#e53935] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <FiSquare className="w-3 h-3 fill-current" /> Stop
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServeClick(request);
                      }}
                      disabled={isServing}
                      className="h-8 w-16 bg-[#1a73e8] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1558c0] transition-colors disabled:opacity-50"
                    >
                      Serve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTransferClick(request);
                      }}
                      disabled={isServing}
                      className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <FiArrowRightCircle className="w-3 h-3" /> Transfer
                    </button>
                  </div>
                );
              default:
                return <span>{request[header.key] || '-'}</span>;
            }
          }}
           pagination={{
             currentPage,
             totalPages: Math.ceil(filteredRequests.length / 20),
             totalCount: filteredRequests.length,
             itemsPerPage: 20,
             onPageChange: setCurrentPage,
             loading
           }}
        />
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
          <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-md overflow-visible">
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
                <SearchableSelect
                  options={departments.map((dept) => ({ 
                    id: dept._id || dept.id || "", 
                    name: dept.department_name || dept.name || "Unknown Department"
                  }))}
                  value={transferDepartment}
                  onChange={handleTransferDepartmentChange}
                  placeholder="Search or select a department..."
                  emptyMessage="No departments found"
                />
              </div>

              {transferDepartment && (
                <div className="mb-4">
                  <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                    Select Unit (Optional)
                  </label>
                  {transferEmployeesLoading ? (
                    <div className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-sm bg-gray-100 flex items-center justify-center">
                      <FiLoader className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-gray-500">Loading units...</span>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        { id: "", name: "No specific unit - Assign to department only" },
                        ...units.map((unit) => ({ 
                          id: unit.id || unit._id || "", 
                          name: `${unit.name}${unit.staffAvailable > 0 ? ` (${unit.staffAvailable} staff)` : ''}`
                        }))
                      ]}
                      value={selectedUnit}
                      onChange={setSelectedUnit}
                      placeholder="Search or select a unit..."
                      disabled={!transferDepartment || units.length === 0}
                      emptyMessage="No units available for this department"
                    />
                  )}
                  {transferDepartment && units.length === 0 && !transferEmployeesLoading && (
                    <p className="text-xs text-gray-500 mt-1">No units available for this department</p>
                  )}
                </div>
              )}

              {transferDepartment && (
                <div className="mb-6">
                  <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">
                    Assign to Specific Employee (Optional)
                  </label>
                  {transferEmployeesLoading ? (
                    <div className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-sm bg-gray-100 flex items-center justify-center">
                      <FiLoader className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-gray-500">Loading employees...</span>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        { id: "", name: "Any available employee in department/unit" },
                        ...transferEmployees.map((emp) => ({ 
                          id: String(emp._id || emp.employee_id || ""), 
                          name: `${emp.full_name || "Unknown"}${emp.title ? ` (${emp.title})` : ''}`
                        }))
                      ]}
                      value={transferEmployee ? String(transferEmployee._id || transferEmployee.employee_id || "") : ""}
                      onChange={(id) => {
                        if (!id) {
                          setTransferEmployee(null);
                          return;
                        }
                        const emp = transferEmployees.find(
                          (em) => String(em._id || em.employee_id) === id
                        );
                        setTransferEmployee(emp || null);
                      }}
                      placeholder="Search or select an employee..."
                      emptyMessage="No employees found in this department"
                      disabled={transferEmployeesLoading}
                    />
                  )}
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
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Transferring...
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

        {/* ===== NEW FEATURE: Visitor Details Popup Modal ===== */}
        {/* This modal shows when clicking on visitor name to display details and actions */}
        {showVisitorDetails && detailsVisitor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-lg overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h2 className="text-[#2C3E50] text-[20px] font-semibold">
                    Visitor Details
                  </h2>
                  <button
                    onClick={() => {
                      setShowVisitorDetails(false);
                      setDetailsVisitor(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body - Visitor Information */}
              <div className="p-6">
                {/* Visitor Basic Info */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-14 h-14 rounded-full ${detailsVisitor.avatarColor} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}
                  >
                    {detailsVisitor.initials}
                  </div>
                  <div>
                    <div className="text-[#2C3E50] text-[18px] font-semibold">
                      {detailsVisitor.visitorName}
                    </div>
                    <div className="text-[#8A94A6] text-[13px]">
                      {detailsVisitor.telephone !== "____"
                        ? detailsVisitor.telephone
                        : "No phone"}
                    </div>
                  </div>
                </div>

                {/* Visitor Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Badge Number */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Badge Number
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.badgeNumber || "N/A"}
                    </div>
                  </div>

                  {/* Visitor ID */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Visitor ID
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.visitorId}
                    </div>
                  </div>

                  {/* ===== NEW: Unity Assigned by Receptionist ===== */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Unity (Receptionist)
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.rawVisitor?.departments_assigned?.[0]
                          ?.department_name ||
                        detailsVisitor.rawVisitor?._departmentGroup ||
                        "General Service"}
                    </div>
                  </div>

                  {/* Assigned To (Current Provider) */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Assigned To
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.assignedTo}
                    </div>
                  </div>

                  {/* Wait Time */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Wait Time
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.waitTime}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Status
                    </div>
                    <div className="text-[14px] font-medium">
                      {detailsVisitor.status === "Not started" && (
                        <span className="text-[#f57c00]">Not Started</span>
                      )}
                      {detailsVisitor.status === "inprogress" && (
                        <span className="text-[#1a73e8] flex items-center gap-1">
                          <FiClock className="w-3 h-3 animate-pulse" />
                          In Progress
                        </span>
                      )}
                      {detailsVisitor.status === "completed" && (
                        <span className="text-[#2e7d32]">Completed</span>
                      )}
                      {detailsVisitor.status === "transfered" && (
                        <span className="text-[#7b1fa2]">Transferred</span>
                      )}
                    </div>
                  </div>

                  {/* Check-in Time */}
                  <div className="bg-[#F7F9FB] rounded-lg p-3 col-span-2">
                    <div className="text-[#8A94A6] text-[11px] uppercase tracking-wider mb-1">
                      Check-in Time
                    </div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">
                      {detailsVisitor.checkInRaw
                        ? new Date(
                            detailsVisitor.checkInRaw,
                          ).toLocaleString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </div>
                  </div>
                </div>

                {/* ===== NEW: Action Buttons in Popup ===== */}
                {/* Serve and Transfer buttons in the visitor details popup */}
                <div className="flex gap-3 mt-6">
                  {detailsVisitor.status === "completed" ? (
                    <div className="flex-1 px-4 py-3 bg-[#e8f5e9] text-[#2e7d32] rounded-[8px] font-medium text-center">
                      ✓ Service Completed
                    </div>
                  ) : detailsVisitor.status === "inprogress" ? (
                    <>
                      <button
                        onClick={() => {
                          setShowVisitorDetails(false);
                          handleServeClick(detailsVisitor);
                        }}
                        disabled={isServing}
                        className="flex-1 px-4 py-3 bg-[#e53935] text-white rounded-[8px] font-medium hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FiSquare className="w-4 h-4 fill-current" />
                        Stop Service
                      </button>
                      <button
                        onClick={() => handleTransferClick(detailsVisitor)}
                        disabled={isServing}
                        className="flex-1 px-4 py-3 bg-[#7b1fa2] text-white rounded-[8px] font-medium hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FiArrowRightCircle className="w-4 h-4" />
                        Transfer
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setShowVisitorDetails(false);
                          handleServeClick(detailsVisitor);
                        }}
                        disabled={isServing}
                        className="flex-1 px-4 py-3 bg-[#1a73e8] text-white rounded-[8px] font-medium hover:bg-[#1558c0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        Serve
                      </button>
                      <button
                        onClick={() => handleTransferClick(detailsVisitor)}
                        disabled={isServing}
                        className="flex-1 px-4 py-3 bg-[#7b1fa2] text-white rounded-[8px] font-medium hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FiArrowRightCircle className="w-4 h-4" />
                        Transfer
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    
  );
};

export default ProvideServicesTab;