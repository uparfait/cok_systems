import React from "react";
import { FiX, FiLoader, FiRefreshCw, FiArrowRightCircle } from "react-icons/fi";
import SearchableSelect from "./SearchableSelect";

interface TransferModalProps {
  show: boolean;
  onClose: () => void;
  departments: any[];
  units: any[];
  transferDepartment: string;
  selectedUnit: string;
  transferring: boolean;
  transferVisitor: any;
  transferEmployee: any;
  transferEmployees: any[];
  transferEmployeesLoading: boolean;
  onDepartmentChange: (id: string) => void;
  onUnitChange: (id: string) => void;
  onEmployeeChange: (emp: any) => void;
  onTransfer: () => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  show, onClose, departments, units, transferDepartment, selectedUnit, transferring,
  transferVisitor, transferEmployee, transferEmployees, transferEmployeesLoading,
  onDepartmentChange, onUnitChange, onEmployeeChange, onTransfer,
}) => {
  if (!show || !transferVisitor) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ height: '100vh' }}>
      <div className="bg-white shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-md overflow-visible max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-[#2C3E50]">Transfer Visitor</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[#8A94A6] uppercase tracking-[1px] mb-2">Visitor</label>
            <div className="flex items-center gap-3 p-3 bg-[#F7F9FB]">
              <div className={`w-10 h-10 flex items-center justify-center text-white text-sm font-bold ${transferVisitor.avatarColor || 'bg-blue-500'}`}>
                <span>{transferVisitor.initials || '??'}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-[#2C3E50]">{transferVisitor.visitorName}</div>
                <div className="text-xs text-[#8A94A6]">Badge: {transferVisitor.badgeNumber || "N/A"}</div>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Department</label>
            <SearchableSelect
              options={departments.map((dept) => ({ id: dept._id || dept.id || "", name: dept.department_name || dept.name || "Unknown Department" }))}
              value={transferDepartment} onChange={onDepartmentChange} placeholder="Search or select a department..." emptyMessage="No departments found"
            />
          </div>
          {transferDepartment && (
            <div className="mb-4">
              <label className="block text-xs text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Unit (Optional)</label>
              {transferEmployeesLoading ? (
                <div className="w-full px-3 py-2 border border-[#D9E1EA] text-sm bg-gray-100 flex items-center justify-center">
                  <FiLoader className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent animate-spin mr-2" />
                  <span className="text-gray-500">Loading units...</span>
                </div>
              ) : (
                <SearchableSelect
                  options={[{ id: "", name: "No specific unit - Assign to department only" }, ...units.map((unit) => ({ id: unit.id || unit._id || "", name: `${unit.name}${unit.staffAvailable > 0 ? ` (${unit.staffAvailable} staff)` : ""}` }))]}
                  value={selectedUnit} onChange={onUnitChange} placeholder="Search or select a unit..." disabled={!transferDepartment || units.length === 0} emptyMessage="No units available"
                />
              )}
            </div>
          )}
          {transferDepartment && (
            <div className="mb-5">
              <label className="block text-xs text-[#8A94A6] uppercase tracking-[1px] mb-2">Assign to Specific Employee (Optional)</label>
              {transferEmployeesLoading ? (
                <div className="w-full px-3 py-2 border border-[#D9E1EA] text-sm bg-gray-100 flex items-center justify-center">
                  <FiLoader className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent animate-spin mr-2" />
                  <span className="text-gray-500">Loading employees...</span>
                </div>
              ) : (
                <SearchableSelect
                  options={[{ id: "", name: "Any available employee in department/unit" }, ...transferEmployees.map((emp) => ({ id: String(emp._id || emp.employee_id || ""), name: `${emp.full_name || "Unknown"}${emp.title ? ` (${emp.title})` : ""}` }))]}
                  value={transferEmployee ? String(transferEmployee._id || transferEmployee.employee_id || "") : ""}
                  onChange={(id) => { if (!id) { onEmployeeChange(null); return; } const emp = transferEmployees.find((em) => String(em._id || em.employee_id) === id); onEmployeeChange(emp || null); }}
                  placeholder="Search or select an employee..." emptyMessage="No employees found" disabled={transferEmployeesLoading}
                />
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-[#D9E1EA] text-[#2C3E50] font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={onTransfer} disabled={!transferDepartment || transferring} className="flex-1 px-4 py-2 bg-[#0284C7] text-white font-medium hover:bg-[#0369A1] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {transferring ? <><FiRefreshCw className="w-4 h-4 animate-spin" />Transferring...</> : "Transfer Visitor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;