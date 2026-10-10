import React, { useEffect, useState } from 'react';
import { departmentService, employeeService } from '../../services/adminService';
import type { DepartmentTarget } from './visitorTypes';

interface Option {
  id: string;
  name: string;
  staff: number;
}

interface VisitorSendFormProps {
  value: DepartmentTarget | null;
  onChange: (target: DepartmentTarget | null) => void;
  disabled?: boolean;
}

const INPUT = 'w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#056daa] disabled:bg-gray-100';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1';

const toOptions = (list: unknown): Option[] => (Array.isArray(list) ? list : []).map((d: Record<string, unknown>) => ({
  id: String(d._id || d.department_id || ''),
  name: String(d.department_name || d.name || ''),
  staff: Number(d.total_employees || 0),
}));

const VisitorSendForm: React.FC<VisitorSendFormProps> = ({ value, onChange, disabled = false }) => {
  const [departments, setDepartments] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    departmentService.getAll()
      .then((res: { success?: boolean; data?: unknown }) => {
        if (!active) return;
        const all = Array.isArray(res?.data) ? res.data : [];
        setDepartments(toOptions(all.filter((d: Record<string, unknown>) => !d.is_unit && !(d.sub_department_mng as Record<string, unknown> | undefined)?.is_sub_department)));
      })
      .catch(() => active && setDepartments([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setUnitId('');
    setUnits([]);
    if (!departmentId) return undefined;
    let active = true;
    departmentService.getSubDepartments(departmentId)
      .then((res: { data?: unknown }) => active && setUnits(toOptions(res?.data)))
      .catch(() => active && setUnits([]));
    return () => { active = false; };
  }, [departmentId]);

  useEffect(() => {
    setEmployeeId('');
    setEmployees([]);
    const target = unitId || departmentId;
    if (!target) return undefined;
    let active = true;
    employeeService.getByDepartment(target, true, 1, 100)
      .then((res: { data?: unknown }) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setEmployees(list.map((e: Record<string, unknown>) => ({ id: String(e._id), name: String(e.full_name || 'Unknown') })));
      })
      .catch(() => active && setEmployees([]));
    return () => { active = false; };
  }, [departmentId, unitId]);

  useEffect(() => {
    const target = unitId ? units.find((u) => u.id === unitId) : departments.find((d) => d.id === departmentId);
    if (!target) {
      onChange(null);
      return;
    }
    const employee = employees.find((e) => e.id === employeeId);
    onChange({
      department_id: target.id,
      department_name: target.name,
      provider_id: employee ? employee.id : null,
      provider_name: employee ? employee.name : null,
    });
  }, [departmentId, unitId, employeeId, departments, units, employees]);

  const chosen = unitId ? units.find((u) => u.id === unitId) : departments.find((d) => d.id === departmentId);
  const noStaff = !!chosen && chosen.staff === 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className={`${LABEL} cok-req`}>Department</label>
        <select className={INPUT} disabled={disabled || loading} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">{loading ? 'Loading departments...' : 'Choose a department'}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL}>Unit</label>
        <select className={INPUT} disabled={disabled || !departmentId || units.length === 0} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">{units.length ? 'Whole department' : 'No units'}</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className={LABEL}>Employee</label>
        <select className={INPUT} disabled={disabled || !departmentId} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">Anyone available</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {noStaff ? <p className="sm:col-span-3 text-xs text-red-600">There is no employee in this {unitId ? 'unit' : 'department'} yet.</p> : null}
      {value ? <p className="sm:col-span-3 text-xs text-gray-500">Sending to {value.department_name}{value.provider_name ? `, ${value.provider_name}` : ''}.</p> : null}
    </div>
  );
};

export default VisitorSendForm;
