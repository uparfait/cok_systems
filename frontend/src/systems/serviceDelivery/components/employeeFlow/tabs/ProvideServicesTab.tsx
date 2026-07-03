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
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import {
  serviceDeliveryService,
  departmentService,
  employeeService,
} from "../../../../../core/services/adminService";
import { useToast } from "../../../../../core/contexts/ToastContext";

// SearchableSelect Component
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
  emptyMessage = "No options found",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayText, setDisplayText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

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
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()),
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
          {icon && (
            <span className="mr-2 text-[#0284C7]">
              <FiSearch className="w-4 h-4" />
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayText}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={value ? "" : placeholder}
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
            filteredOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-[#e8f4fe] text-[#2C3E50] text-[13px] border-b border-gray-100 ${
                  option.id === value
                    ? "bg-[#0284C7] text-white font-medium"
                    : "text-gray-700 hover:bg-blue-50"
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

// Live Timer Component
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

export interface ProvideServicesTabProps {
  isDashboardView?: boolean;
}

const ProvideServicesTab: React.FC<ProvideServicesTabProps> = ({
  isDashboardView = false,
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServing, setIsServing] = useState(false);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<any>(null);
  const [transferDepartment, setTransferDepartment] = useState<string>("");
  const [transferEmployee, setTransferEmployee] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] =
    useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");

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

  // Fetch search suggestions for preview
  const fetchSearchSuggestions = useCallback(
    async (query: string) => {
      if (!query || query.trim().length === 0) {
        setSearchSuggestions([]);
        setShowSearchPreview(false);
        return;
      }

      try {
        const response = await serviceDeliveryService.search(query, 1, 5);
        if (response && response.success) {
          const allVisitors: any[] = response.data || [];

          const formattedSuggestions = allVisitors
            .map((v: any) => {
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

              const myAssignment = v.departments_assigned?.find(
                (d: any) => String(d.provider_id) === myId,
              );
              const checkInTime =
                myAssignment?.assigned_time ||
                v.entry_date ||
                new Date().toISOString();

              const serviceDuration = v.durations?.services_durations?.find(
                (d: any) =>
                  String(d.provider_id) === myId && d.ended_at === null,
              );
              const serviceStartTimeVal = serviceDuration?.started_at || "";

              let myServiceStatus = null;
              if (Array.isArray(v.services_status)) {
                myServiceStatus = v.services_status.find(
                  (s: any) => String(s.provider_id) === myId,
                );
              }

              let status = (
                myServiceStatus?.s_type ||
                v.status ||
                "Not started"
              ).toLowerCase();
              if (status === "not started") status = "Not started";
              if (status === "inprogress") status = "inprogress";
              if (status === "completed") status = "completed";
              if (status === "transfered" || status === "transferred")
                status = "transfered";

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

              const assignedToDisplay =
                myAssignment?.provider_name ||
                myAssignment?.department_name ||
                "Unassigned";

              return {
                id: v._id || v.id,
                visitorName: visitorName,
                visitorId: identification,
                badgeNumber: badgeNumber,
                assignedTo: assignedToDisplay,
                serviceType:
                  myAssignment?.department_name ||
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
                    myServiceStatus.s_type?.toLowerCase() === "transferred"
                  : false,
              };
            })
            .reverse();

          setSearchSuggestions(formattedSuggestions);
          setShowSearchPreview(true);
        }
      } catch (error) {
        console.error("Error fetching search suggestions:", error);
      }
    },
    [myId],
  );

  // Handle suggestion click
  const handleSuggestionClick = async (suggestion: any) => {
    setSearchTerm(suggestion.visitorName);
    setShowSearchPreview(false);
    setSearchSuggestions([]);
    setCurrentPage(1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    try {
      const response = await serviceDeliveryService.search(
        suggestion.visitorName,
        1,
        20,
      );
      if (response && response.success) {
        const allVisitors: any[] = response.data || [];
        const formattedRequests = formatVisitors(allVisitors);
        setRequests(formattedRequests);
        setTotalCount(formattedRequests.length);
        setTotalPages(Math.ceil(formattedRequests.length / 20));
      }
    } catch (error) {
      console.error("Error fetching search result:", error);
    }
  };

  const formatVisitors = (allVisitors: any[]) => {
    return allVisitors.map((v: any) => {
      const colors = [
        "bg-purple-500",
        "bg-pink-500",
        "bg-yellow-400",
        "bg-teal-500",
        "bg-lavender-400",
        "bg-blue-500",
      ];
      const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
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

      const myAssignment = v.departments_assigned?.find(
        (d: any) => String(d.provider_id) === myId,
      );
      const checkInTime =
        myAssignment?.assigned_time || v.entry_date || new Date().toISOString();

      const serviceDuration = v.durations?.services_durations?.find(
        (d: any) => String(d.provider_id) === myId && d.ended_at === null,
      );
      const serviceStartTimeVal = serviceDuration?.started_at || "";

      let myServiceStatus = null;
      if (Array.isArray(v.services_status)) {
        myServiceStatus = v.services_status.find(
          (s: any) => String(s.provider_id) === myId,
        );
      }

      let status = (
        myServiceStatus?.s_type ||
        v.status ||
        "Not started"
      ).toLowerCase();
      if (status === "not started") status = "Not started";
      if (status === "inprogress") status = "inprogress";
      if (status === "completed") status = "completed";
      if (status === "transfered" || status === "transferred")
        status = "transfered";

      const waitTimeEndStamp =
        (status === "inprogress" ||
          status === "completed" ||
          status === "transfered") &&
        serviceStartTimeVal
          ? new Date().getTime()
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

      const assignedToDisplay =
        myAssignment?.provider_name ||
        myAssignment?.department_name ||
        "Unassigned";

      return {
        id: v._id || v.id,
        visitorName: visitorName,
        visitorId: identification,
        badgeNumber: badgeNumber,
        assignedTo: assignedToDisplay,
        serviceType:
          myAssignment?.department_name ||
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
            myServiceStatus.s_type?.toLowerCase() === "transferred"
          : false,
      };
    });
  };

  const fetchAssignedVisitors = useCallback(
    async (
      silent: boolean = false,
      page: number = currentPage,
      query: string = searchTerm,
    ) => {
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
          response = await serviceDeliveryService.getCurrentVisitorsByProvider(
            myId,
            page,
            20,
          );
        }

        if (response && response.success) {
          const allVisitors: any[] = response.data || [];
          setTotalCount(response.total || 0);
          setTotalPages(Math.ceil((response.total || 0) / 20));
          const formattedRequests = formatVisitors(allVisitors);
          setRequests(formattedRequests);
        }
      } catch (error) {
        console.error("Error fetching assigned visitors:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [myId, currentPage, searchTerm],
  );

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

  const handleTransferVisitor = async () => {
    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);
    try {
      const targetId = selectedUnit || transferDepartment;
      const targetInfo = selectedUnit
        ? units.find((u) => u.id === selectedUnit)
        : departments.find((d) => d._id === transferDepartment);
      const targetName =
        targetInfo?.name || targetInfo?.department_name || "Unknown";

      const currentDept =
        transferVisitor.rawVisitor?.departments_assigned?.find(
          (d: any) => String(d.provider_id) === myId,
        );
      const previousDepartmentId = currentDept?.department_id;

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

  const handleTransferClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    request: any,
  ) => {
    e.stopPropagation();
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

  const handleVisitorClick = (request: any) => {
    navigate(`/service-delivery/visitors/${request.id}`);
  };

  const handleSearchTyping = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (value && value.trim().length >= 1) {
        searchTimeoutRef.current = setTimeout(() => {
          fetchSearchSuggestions(value);
        }, 1);
      } else {
        setSearchSuggestions([]);
        setShowSearchPreview(false);
      }
    },
    [fetchSearchSuggestions],
  );

  const filteredRequests = requests
    .filter((request) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        request.visitorName.toLowerCase().includes(searchLower) ||
        request.visitorId.toLowerCase().includes(searchLower) ||
        request.badgeNumber.toLowerCase().includes(searchLower) ||
        request.telephone?.toLowerCase().includes(searchLower);

      let normalizedStatus = request.status
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
      if (normalizedStatus === "transfered") normalizedStatus = "transferred";
      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const getStatusKey = (status: string) =>
        status.replace(/[\s_]+/g, "-").toLowerCase();
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

  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * 20,
    currentPage * 20,
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);



  useEffect(() => {
    fetchDepartments();
  }, []);

    // this is an effect to refresh a page every after 10 seconds to get the latest status of the visitors without refreshing the page, but only if there is no search term, and not in dashboard view
  // by using fetchAssignedVisitors function

  useEffect(() => {
    if (searchTerm?.trim()?.length >= 1) return;
    const interval = setInterval(() => {
      fetchAssignedVisitors(true, currentPage, searchTerm);
    }, 10000);
    return () => clearInterval(interval);
  }, [isDashboardView, searchTerm, fetchAssignedVisitors, currentPage]);

  useEffect(() => {
    fetchAssignedVisitors(false);
  }, []);

  return (
    <div className={isDashboardView ? "" : "p-7"}>
      {/* Search Bar Section */}
      <div
        className={`bg-white rounded-[14px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] ${!isDashboardView ? "mt-6" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex">
              <div className="flex-1 relative min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by visitor name, ID, or badge..."
                  value={searchTerm}
                  onChange={(e) => handleSearchTyping(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-l-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8]"
                  onFocus={() =>
                    searchTerm &&
                    searchTerm?.trim()?.length >= 1 &&
                    setShowSearchPreview(true)
                  }
                />
                {/* Search Preview Dropdown */}
                {showSearchPreview && searchSuggestions.length > 0 && (
                  <div
                    className="absolute z-50 w-full mt-1 bg-white border border-[#e0e0e0] rounded-[8px] shadow-lg max-h-60 overflow-y-auto"
                    style={{ minWidth: "400px" }}
                  >
                    <div className="py-1">
                      {searchSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#e8f4fe] transition-colors"
                        >
                          <div
                            className={`w-8 h-8 rounded-full ${suggestion.avatarColor} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}
                          >
                            {suggestion.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[#2C3E50] text-[13px] font-medium truncate">
                              {suggestion.visitorName}
                            </div>
                            <div className="text-[#888] text-[11px] truncate">
                              ID: {suggestion.visitorId}
                            </div>
                          </div>
                          <div className="text-[#666] text-[11px] whitespace-nowrap">
                            {suggestion.status === "Not started" && (
                              <span className="text-[#f57c00]">
                                Not started
                              </span>
                            )}
                            {suggestion.status === "inprogress" && (
                              <span className="text-[#1a73e8]">
                                In progress
                              </span>
                            )}
                            {suggestion.status === "completed" && (
                              <span className="text-[#2e7d32]">Completed</span>
                            )}
                            {suggestion.status === "transfered" && (
                              <span className="text-[#7b1fa2]">
                                Transferred
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Click outside handler */}
                {showSearchPreview && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSearchPreview(false)}
                  />
                )}
              </div>
              <button
                onClick={() => {
                  setCurrentPage(1);
                  setShowSearchPreview(false);
                  setSearchSuggestions([]);
                  fetchAssignedVisitors(false, 1, searchTerm);
                }}
                disabled={loading}
                className="h-11 px-5 bg-[#1a73e8] text-white rounded-r-[8px] hover:bg-[#1557b0] focus:ring-2 focus:ring-[#1a73e8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-[13px] font-medium min-w-[100px] justify-center"
              >
                {loading && searchTerm ? (
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                ) : null}
                {loading && searchTerm ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#1a73e8] bg-white min-w-[140px] flex-shrink-0"
          >
            <option value="all">All Status</option>
            <option value="not-started">Not Started</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {isDashboardView && (
            <button
              onClick={() => {
                setShowSearchPreview(false);
                setSearchSuggestions([]);
                if (searchTimeoutRef.current)
                  clearTimeout(searchTimeoutRef.current);
                fetchAssignedVisitors(false);
              }}
              className="flex items-center gap-2 h-11 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50 min-w-[100px] justify-center"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[14px] p-4 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-x-auto">
        <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-blue-50 border-b border-[#E2E8F0]">
                  <th className="text-left text-[11px] font-bold text-gray-700 uppercase tracking-[0.5px] px-4 py-3 w-[5%]">
                    #
                  </th>
                  <th className="text-left text-[11px] font-bold text-gray-700 uppercase tracking-[0.5px] px-4 py-3 w-[15%]">
                    VISITOR / BADGE
                  </th>
                  <th className="text-left text-[11px] font-bold text-gray-700 uppercase tracking-[0.5px] px-4 py-3 w-[12%]">
                    VISITOR ID
                  </th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">
                DURATIONS
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
                  Loading...
                </td>
              </tr>
            ) : paginatedRequests.length > 0 ? (
              paginatedRequests.map((request) => (
                <tr
                  title="Click to view visitor details"
                  key={request.id}
                  className="border-b border-[#f8f8f8] h-14 cursor-pointer"
                  onClick={() => handleVisitorClick(request)}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}
                      >
                        {request.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          onClick={() => handleVisitorClick(request)}
                          className="text-[#333] text-[13px] font-medium truncate cursor-pointer hover:text-[#1a73e8] hover:underline inline-flex items-center gap-2"
                        >
                          {request.visitorName}
                          <span className="inline-block w-4 h-4 text-gray-400">
                            <svg
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </span>
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
                    ) : (
                      <button
                        title="Click to transifer visitor to another department"
                        onClick={(e) => handleTransferClick(e, request)}
                        disabled={isServing}
                        className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <FiArrowRightCircle className="w-3 h-3" /> Transfer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  {searchTerm
                    ? "No visitors found matching your search."
                    : "No visitors found for your department."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-100">
            <div className="text-[#666] text-[12px]">
              Showing {(currentPage - 1) * 20 + 1} to{" "}
              {Math.min(currentPage * 20, totalCount)} of {totalCount} visitors
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-[6px] border border-gray-200 text-gray-600 text-[12px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 text-[12px] font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-[6px] border border-gray-200 text-gray-600 text-[12px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
                    name:
                      dept.department_name || dept.name || "Unknown Department",
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
                        {
                          id: "",
                          name: "No specific unit - Assign to department only",
                        },
                        ...units.map((unit) => ({
                          id: unit.id || unit._id || "",
                          name: `${unit.name}${unit.staffAvailable > 0 ? ` (${unit.staffAvailable} staff)` : ""}`,
                        })),
                      ]}
                      value={selectedUnit}
                      onChange={setSelectedUnit}
                      placeholder="Search or select a unit..."
                      disabled={!transferDepartment || units.length === 0}
                      emptyMessage="No units available for this department"
                    />
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
                      <span className="text-gray-500">
                        Loading employees...
                      </span>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        {
                          id: "",
                          name: "Any available employee in department/unit",
                        },
                        ...transferEmployees.map((emp) => ({
                          id: String(emp._id || emp.employee_id || ""),
                          name: `${emp.full_name || "Unknown"}${emp.title ? ` (${emp.title})` : ""}`,
                        })),
                      ]}
                      value={
                        transferEmployee
                          ? String(
                              transferEmployee._id ||
                                transferEmployee.employee_id ||
                                "",
                            )
                          : ""
                      }
                      onChange={(id) => {
                        if (!id) {
                          setTransferEmployee(null);
                          return;
                        }
                        const emp = transferEmployees.find(
                          (em) => String(em._id || em.employee_id) === id,
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
    </div>
  );
};

export default ProvideServicesTab;
