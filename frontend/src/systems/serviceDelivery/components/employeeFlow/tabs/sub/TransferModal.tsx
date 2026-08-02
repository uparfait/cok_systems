import React from "react";
import { FiX, FiLoader, FiRefreshCw, FiArrowRightCircle } from "react-icons/fi";
import SearchableSelect from "./SearchableSelect";

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: NEUTRAL_DARK };
const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" style={{ height: '100vh' }}>
      <div className="w-full max-w-md overflow-visible max-h-[90vh] overflow-y-auto" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Transfer Visitor</h2>
            <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}><FiX className="w-5 h-5" /></button>
          </div>
          <div className="mb-4">
            <label className="block mb-2" style={labelStyle}>Visitor</label>
            <div className="flex items-center gap-3 p-3 bg-[#F7F9FB]">
              <div className={`w-10 h-10 flex items-center justify-center text-white text-sm font-bold ${transferVisitor.avatarColor || 'bg-[#056daa]'}`}>
                <span>{transferVisitor.initials || '??'}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-[#333333]">{transferVisitor.visitorName}</div>
                <div className="text-xs text-[#9E9E9E]">Badge: {transferVisitor.badgeNumber || "N/A"}</div>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-2" style={labelStyle}>Select Department</label>
            <SearchableSelect
              options={departments.map((dept) => ({ id: dept._id || dept.id || "", name: dept.department_name || dept.name || "Unknown Department" }))}
              value={transferDepartment} onChange={onDepartmentChange} placeholder="Search or select a department..." emptyMessage="No departments found"
            />
          </div>
          {transferDepartment && (
            <div className="mb-4">
              <label className="block mb-2" style={labelStyle}>Select Unit (Optional)</label>
              {transferEmployeesLoading ? (
                <div className="w-full px-3 py-2 border border-[#E0E0E0] text-sm bg-[#F7F9FB] flex items-center justify-center">
                  <FiLoader className="w-4 h-4 animate-spin mr-2" style={{ color: PRIMARY }} />
                  <span className="text-[#9E9E9E]">Loading units...</span>
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
              <label className="block mb-2" style={labelStyle}>Assign to Specific Employee (Optional)</label>
              {transferEmployeesLoading ? (
                <div className="w-full px-3 py-2 border border-[#E0E0E0] text-sm bg-[#F7F9FB] flex items-center justify-center">
                  <FiLoader className="w-4 h-4 animate-spin mr-2" style={{ color: PRIMARY }} />
                  <span className="text-[#9E9E9E]">Loading employees...</span>
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
            <button onClick={onClose} className="cok-btn-outlined flex-1" style={btnTypography}>Cancel</button>
            <button onClick={onTransfer} disabled={!transferDepartment || transferring} className="cok-btn-primary flex-1 flex items-center justify-center gap-2" style={btnTypography}>
              {transferring ? <><FiRefreshCw className="w-4 h-4 animate-spin" />Transferring...</> : "Transfer Visitor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
