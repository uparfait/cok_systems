import React from 'react';
import { FiUser, FiBriefcase, FiShield, FiInfo } from 'react-icons/fi';
import OverlayShell from '../../../core/components/overlay/OverlayShell';

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
    <OverlayShell
      title={
        <span className="inline-flex items-center gap-2 max-w-full">
          <span className="w-7 h-7 bg-[rgba(5,109,170,0.1)] text-[#056daa] text-xs font-semibold inline-flex items-center justify-center shrink-0">{initials}</span>
          <span className="truncate">{employee.full_name || 'Employee Details'}</span>
        </span>
      }
      subtitle={employee.email ? <span className="block truncate">{employee.email}</span> : undefined}
      onClose={onClose}
      width="lg"
      bodyClassName="space-y-4"
    >
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
    </OverlayShell>
  );
};

export default EmployeeDetailsModal;
