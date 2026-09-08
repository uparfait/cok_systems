import React from 'react';
import { FiX, FiUser, FiBriefcase, FiShield, FiInfo } from 'react-icons/fi';

const PRIMARY = '#056daa';
const fontHeading = "'Montserrat', sans-serif";

interface EmployeeDetailsModalProps {
  employee: any;
  unitName?: string;
  onClose: () => void;
}

const formatRole = (role?: string) =>
  role ? role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '';

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 break-words min-w-0">{value}</span>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="border border-gray-200">
    <div className="px-4 py-2.5 bg-[#F7F9FB] border-b border-gray-200 flex items-center gap-2">
      <span className="text-[#056daa]">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>{title}</h3>
    </div>
    <div className="px-4 py-2 divide-y divide-gray-100">{children}</div>
  </div>
);

const EmployeeDetailsModal: React.FC<EmployeeDetailsModalProps> = ({ employee, unitName, onClose }) => {
  if (!employee) return null;

  const departmentName =
    employee.department_name ||
    (employee.department && typeof employee.department === 'object' ? employee.department.department_name : typeof employee.department === 'string' ? employee.department : '') ||
    '';
  const idType = employee.identification?.id_type || '';
  const idNumber = employee.identification?.number || '';
  const isLocked = employee.access_control?.is_locked === true;
  const lockReason = employee.access_control?.reason || '';
  const initials = (employee.full_name || 'E')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 sm:px-5 py-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: PRIMARY }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 flex items-center justify-center shrink-0">
              <span className="font-semibold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate" style={{ fontFamily: fontHeading }}>{employee.full_name || 'Employee Details'}</h2>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{employee.email || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 cursor-pointer shrink-0" title="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Section title="Personal Information" icon={<FiUser className="w-4 h-4" />}>
            <Row label="Full Name" value={employee.full_name} />
            <Row label="Email" value={employee.email} />
            <Row label="Telephone" value={employee.telephone} />
            <Row label="Gender" value={employee.gender} />
            <Row label="Identification" value={idNumber ? `${idType ? `${idType}: ` : ''}${idNumber}` : ''} />
          </Section>

          <Section title="Work Information" icon={<FiBriefcase className="w-4 h-4" />}>
            <Row label="Department" value={departmentName || '-'} />
            <Row label="Department Unit" value={unitName || ''} />
            <Row label="Position" value={formatRole(employee.roles?.role_name)} />
            <Row label="Title" value={employee.title} />
            <Row label="Status" value={employee.status} />
          </Section>

          <Section title="Account & Security" icon={<FiShield className="w-4 h-4" />}>
            <Row
              label="Activation"
              value={
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${employee.is_account_activated ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]'}`}>
                  {employee.is_account_activated ? 'Activated' : 'Not Activated'}
                </span>
              }
            />
            <Row
              label="Account Lock"
              value={
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${isLocked ? 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]' : 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]'}`}>
                  {isLocked ? 'Locked' : 'Unlocked'}
                </span>
              }
            />
            <Row label="Lock Reason" value={isLocked ? lockReason : ''} />
            <Row
              label="2FA"
              value={
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${employee.is_2FA_disabled ? 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]' : 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]'}`}>
                  {employee.is_2FA_disabled ? 'Disabled' : 'Enabled'}
                </span>
              }
            />
            <Row label="Failed Login Attempts" value={employee.access_control?.last_login_attempt ? String(employee.access_control.last_login_attempt) : ''} />
          </Section>

          <Section title="Other" icon={<FiInfo className="w-4 h-4" />}>
            <Row label="Created" value={employee.createdAt || employee.created_at ? new Date(employee.createdAt || employee.created_at).toLocaleString() : ''} />
            <Row label="Updated" value={employee.updatedAt || employee.updated_at ? new Date(employee.updatedAt || employee.updated_at).toLocaleString() : ''} />
          </Section>
        </div>

        <div className="p-3 border-t border-gray-200 flex justify-end shrink-0">
          <button onClick={onClose} className="cok-btn-outlined cursor-pointer" style={{ padding: '0.5rem 1.4rem' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsModal;
