import React, { useState, useEffect, useRef } from "react";
import {
  FiX,
  FiLoader,
  FiMail,
  FiPhone,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { useToast } from "../contexts/ToastContext";
import {
  departmentService,
  employeeService,
  serviceDeliveryService,
} from "../services/adminService";
import LoadingSpinner from "./LoadingSpinner";

interface AssignVisitorComponentProps {
  visitorId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorTelephone?: string;
  onClose: () => void;
  onAssigned?: () => void;
  departmentCounts?: Record<string, number>;
}

interface Option {
  id: string;
  name: string;
  staff?: number;
}

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: TERTIARY,
};

const renderIcon = (icon: React.ReactNode) => (
  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#9CA3AF]">
    {icon}
  </span>
);

const AssignVisitorComponent: React.FC<AssignVisitorComponentProps> = ({
  visitorId,
  visitorName,
  visitorEmail,
  visitorTelephone,
  onClose,
  onAssigned,
  departmentCounts,
}) => {
  const { showSuccess, showError } = useToast();
  const [departments, setDepartments] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [deptSearch, setDeptSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [deptLoading, setDeptLoading] = useState(false);
  const [unitLoading, setUnitLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);

  const deptRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const empRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node))
        setDeptOpen(false);
      if (unitRef.current && !unitRef.current.contains(e.target as Node))
        setUnitOpen(false);
      if (empRef.current && !empRef.current.contains(e.target as Node))
        setEmpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDept) {
      setUnits([]);
      setSelectedUnit("");
      setUnitSearch("");
      return;
    }
    loadUnits(selectedDept);
    setSelectedUnit("");
    setUnitSearch("");
    setSelectedEmployee("");
    setEmployees([]);
  }, [selectedDept]);

  useEffect(() => {
    if (selectedUnit) {
      setSelectedEmployee("");
      setEmpSearch("");
    }
    if (!selectedDept) return;
    loadEmployees();
  }, [selectedDept, selectedUnit]);

  const loadDepartments = async () => {
    setDeptLoading(true);
    try {
      const res = await departmentService.getAll();
      if (res?.success && Array.isArray(res.data)) {
        const list = res.data
          .filter(
            (d: any) => !d.sub_department_mng?.is_sub_department && !d.is_unit,
          )
          .map((d: any) => ({
            id: d._id || d.department_id,
            name: d.department_name || d.name,
            staff: d.total_employees || 0,
          }));
        setDepartments(list);
      }
    } catch {
      showError("Failed to load departments");
    } finally {
      setDeptLoading(false);
    }
  };

  const loadUnits = async (deptId: string) => {
    setUnitLoading(true);
    try {
      const res = await departmentService.getSubDepartments(deptId);
      let list: Option[] = [];
      if (res?.success && Array.isArray(res.data)) {
        list = res.data.map((d: any) => ({
          id: d._id || d.department_id,
          name: d.department_name || d.name,
          staff: d.total_employees || 0,
        }));
      }
      setUnits(list);
    } catch {
      showError("Failed to load units");
    } finally {
      setUnitLoading(false);
    }
  };

  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const targetId = selectedUnit || selectedDept;
      if (!targetId) return;
      const res = await employeeService.getByDepartment(targetId, true, 1, 100);
      if (res?.success && Array.isArray(res.data)) {
        setEmployees(
          res.data.map((e: any) => ({
            id: e._id,
            name: e.full_name || "Unknown",
          })),
        );
      } else {
        setEmployees([]);
      }
    } catch {
      showError("Failed to load employees");
    } finally {
      setEmpLoading(false);
    }
  };

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase()),
  );
  const filteredUnits = units.filter((u) =>
    u.name.toLowerCase().includes(unitSearch.toLowerCase()),
  );
  const filteredEmps = employees.filter((e) =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()),
  );

  const selectedDeptObj = departments.find((d) => d.id === selectedDept);
  const selectedUnitObj = units.find((u) => u.id === selectedUnit);
  const deptQueue =
    (selectedDeptObj ? departmentCounts?.[selectedDeptObj.name] || 0 : 0) + 1;
  const unitQueue = selectedUnitObj
    ? (departmentCounts?.[selectedUnitObj.name] || 0) + 1
    : 0;
  const deptStaff = selectedDeptObj ? selectedDeptObj.staff || 0 : 0;
  const unitStaff = selectedUnitObj ? selectedUnitObj.staff || 0 : 0;
  const currentAvailableStaff =
    (selectedUnit
      ? selectedUnitObj?.staff || 0
      : selectedDeptObj?.staff || 0) || 0;
  const canSubmit = selectedDept && currentAvailableStaff > 0 && !submitting;

  const handleSubmit = async () => {
    if (!selectedDept) {
      showError("Please select a department");
      return;
    }
    if (currentAvailableStaff <= 0) {
      showError("No staff available in selected department/unit");
      return;
    }

    const targetId = selectedUnit || selectedDept;
    const targetObj = selectedUnit ? selectedUnitObj : selectedDeptObj;
    const targetName = targetObj ? targetObj.name : "";
    const selectedEmpObj = employees.find((e) => e.id === selectedEmployee);
    const providerId = selectedEmpObj?.id || null;
    const providerName = selectedEmpObj?.name || null;

    setSubmitting(true);
    try {
      const res = await serviceDeliveryService.assignToDepartment(
        visitorId,
        targetId,
        targetName,
        providerId,
        providerName,
        null,
      );
      if (res?.success || res?.status) {
        showSuccess("Visitor assigned successfully");
        onAssigned?.();
        onClose();
      } else {
        showError(res?.message || res?.error || "Assignment failed");
      }
    } catch {
      showError("Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeptSearch = () => {
    setSelectedDept("");
    setDeptSearch("");
    setDeptOpen(true);
  };

  const openUnitSearch = () => {
    if (!selectedDept) return;
    setSelectedUnit("");
    setUnitSearch("");
    setUnitOpen(true);
  };

  const openEmpSearch = () => {
    if (!selectedDept) return;
    setSelectedEmployee("");
    setEmpSearch("");
    setEmpOpen(true);
  };

  const confirmDisabled = !canSubmit;
  const confirmOpacity = confirmDisabled ? 0.5 : 1;
  const confirmCursor = confirmDisabled ? "not-allowed" : "pointer";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center cok-logout-overlay">
      <div
        className="w-[100%] max-w-3xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl flex flex-col"
        style={{ borderRadius: 0 }}
      >
        <div
          className="sticky top-0 z-20 cok-bg-primary px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between"
          style={{ borderRadius: 0 }}
        >
          <h2
            className="text-white font-bold text-lg sm:text-xl uppercase tracking-wide"
            style={{
              fontFamily: "var(--cok-font-heading)",
              letterSpacing: "1px",
            }}
          >
            Assign Visitor to Department
          </h2>
          <button
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: "0.4rem 0.8rem" }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Visitor Info */}
          <div
            className="p-4"
            style={{
              backgroundColor: NEUTRAL_LIGHT,
              border: "1px solid #E0E0E0",
              borderRadius: 0,
            }}
          >
            <h3
              className="text-xs font-semibold uppercase mb-3"
              style={{ fontFamily: fontHeading, color: PRIMARY }}
            >
              Visitor Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="cok-auth-label">Full Name</label>
                <div className="flex items-center gap-2 mt-1">
                  <FiUser
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={visitorName || "---"}
                  >
                    {visitorName || "---"}
                  </span>
                </div>
              </div>
              <div>
                <label className="cok-auth-label">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <FiMail
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={visitorEmail || "---"}
                  >
                    {visitorEmail || "---"}
                  </span>
                </div>
              </div>
              <div>
                <label className="cok-auth-label">Telephone</label>
                <div className="flex items-center gap-2 mt-1">
                  <FiPhone
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={visitorTelephone || "---"}
                  >
                    {visitorTelephone || "---"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Department Selection */}
          <div ref={deptRef} className="relative">
            <label className="cok-auth-label">Department</label>
            {selectedDept && selectedDeptObj ? (
              <div
                className="cok-auth-input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FiUsers
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={selectedDeptObj.name}
                  >
                    {selectedDeptObj.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openDeptSearch}
                  className="text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                  style={{ color: PRIMARY, fontFamily: fontHeading }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  {renderIcon(<FiUsers className="h-5 w-5" />)}
                  <input
                    value={deptSearch}
                    onChange={(e) => {
                      setDeptSearch(e.target.value);
                      setDeptOpen(true);
                    }}
                    onFocus={openDeptSearch}
                    className="cok-auth-input pr-3 py-3"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder="Search department..."
                  />
                </div>
                {deptLoading && (
                  <div className="absolute right-2 top-2">
                    <LoadingSpinner size="sm" showMessage={false} />
                  </div>
                )}
              </div>
            )}
            {deptOpen && (
              <div
                className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                style={{
                  borderColor: "#E0E0E0",
                  borderRadius: 0,
                  position: "absolute",
                }}
              >
                {filteredDepts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No results
                  </div>
                ) : (
                  filteredDepts.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        setSelectedDept(d.id);
                        setDeptSearch(d.name);
                        setDeptOpen(false);
                      }}
                      className={`px-3 py-2 cursor-pointer text-sm ${d.id === selectedDept ? "bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                      title={d.name}
                    >
                      {d.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Unit Selection */}
          <div ref={unitRef} className="relative">
            <label className="cok-auth-label">
              Unit {selectedUnit ? "" : "(Optional)"}
            </label>
            {selectedUnit && selectedUnitObj ? (
              <div
                className="cok-auth-input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FiUsers
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={selectedUnitObj.name}
                  >
                    {selectedUnitObj.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openUnitSearch}
                  className="text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                  style={{ color: PRIMARY, fontFamily: fontHeading }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  {renderIcon(<FiUsers className="h-5 w-5" />)}
                  <input
                    value={unitSearch}
                    onChange={(e) => {
                      setUnitSearch(e.target.value);
                      setUnitOpen(true);
                    }}
                    onFocus={openUnitSearch}
                    disabled={!selectedDept}
                    className="cok-auth-input pr-3 py-3"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder={
                      selectedDept
                        ? "Search unit or none..."
                        : "Select department first"
                    }
                  />
                </div>
                {unitLoading && (
                  <div className="absolute right-2 top-2">
                    <LoadingSpinner size="sm" showMessage={false} />
                  </div>
                )}
              </div>
            )}
            {unitOpen && selectedDept && (
              <div
                className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                style={{
                  borderColor: "#E0E0E0",
                  borderRadius: 0,
                  position: "absolute",
                }}
              >
                <div
                  onClick={() => {
                    setSelectedUnit("");
                    setUnitSearch("");
                    setUnitOpen(false);
                  }}
                  className={`px-3 py-2 cursor-pointer text-sm ${!selectedUnit ? "bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  No specific unit
                </div>
                {filteredUnits.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUnit(u.id);
                      setUnitSearch(u.name);
                      setUnitOpen(false);
                    }}
                    className={`px-3 py-2 cursor-pointer text-sm ${u.id === selectedUnit ? "bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                    title={u.name}
                  >
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue / Staff */}
          {(selectedDept || selectedUnit) && (
            <div className="grid grid-cols-2 gap-4">
              <div
                className="p-3"
                style={{
                  backgroundColor: NEUTRAL_LIGHT,
                  borderRadius: 0,
                  border: "1px solid #E0E0E0",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase"
                  style={{
                    fontFamily: "var(--cok-font-heading)",
                    color: "#333",
                  }}
                >
                  Current Queue
                </p>
                <p className="text-xl font-bold" style={{ color: PRIMARY }}>
                  {(selectedUnit ? unitQueue : deptQueue) || 0}
                </p>
              </div>
              <div
                className="p-3"
                style={{
                  backgroundColor: NEUTRAL_LIGHT,
                  borderRadius: 0,
                  border: "1px solid #E0E0E0",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase"
                  style={{
                    fontFamily: "var(--cok-font-heading)",
                    color: "#333",
                  }}
                >
                  Available Staff
                </p>
                <p
                  className="text-xl font-bold"
                  style={{
                    color:
                      ((selectedUnit ? unitStaff : deptStaff) || 0) <= 0
                        ? DANGER
                        : SUCCESS,
                  }}
                >
                  {(selectedUnit ? unitStaff : deptStaff) || 0}
                </p>
              </div>
            </div>
          )}

          {/* Employee Selection */}
          <div ref={empRef} className="relative">
            <label className="cok-auth-label">
              Assign to Employee {selectedEmployee ? "" : "(Optional)"}
            </label>
            {selectedEmployee &&
            employees.find((e) => e.id === selectedEmployee) ? (
              <div
                className="cok-auth-input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FiUser
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: GRAY_DISABLED }}
                  />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: NEUTRAL_DARK }}
                    title={
                      employees.find((e) => e.id === selectedEmployee)?.name
                    }
                  >
                    {employees.find((e) => e.id === selectedEmployee)?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openEmpSearch}
                  className="text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                  style={{ color: PRIMARY, fontFamily: fontHeading }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  {renderIcon(<FiUser className="h-5 w-5" />)}
                  <input
                    value={empSearch}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setEmpOpen(true);
                    }}
                    onFocus={openEmpSearch}
                    disabled={!selectedDept}
                    className="cok-auth-input pr-3 py-3"
                    style={{ paddingLeft: "2.5rem" }}
                    placeholder={
                      selectedDept
                        ? "Search employee or none..."
                        : "Select department first"
                    }
                  />
                </div>
                {empLoading && (
                  <div className="absolute right-2 top-2">
                    <LoadingSpinner size="sm" showMessage={false} />
                  </div>
                )}
              </div>
            )}
            {empOpen && selectedDept && (
              <div
                className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                style={{
                  borderColor: "#E0E0E0",
                  borderRadius: 0,
                  position: "absolute",
                }}
              >
                <div
                  onClick={() => {
                    setSelectedEmployee("");
                    setEmpSearch("");
                    setEmpOpen(false);
                  }}
                  className={`px-3 py-2 cursor-pointer text-sm ${!selectedEmployee ? "bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  No specific employee
                </div>
                {filteredEmps.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => {
                      setSelectedEmployee(e.id);
                      setEmpSearch(e.name);
                      setEmpOpen(false);
                    }}
                    className={`px-3 py-2 cursor-pointer text-sm ${e.id === selectedEmployee ? "bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                    title={e.name}
                  >
                    {e.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t"
          style={{ borderColor: "#E0E0E0" }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={confirmDisabled}
            className="cok-btn-primary flex max-h-[50px] flex-row items-center justify-center gap-2 w-full sm:w-auto sm:ml-auto"
            style={{
              padding: "0.7rem 1.2rem",
              opacity: confirmOpacity,
              cursor: confirmCursor,
            }}
          >
            {submitting && <FiLoader className="w-4 h-4 animate-spin" />}
            Confirm Assignment
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full cok-btn-outlined-reverse"
            style={{ padding: "0.9rem 1.2rem" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignVisitorComponent;
