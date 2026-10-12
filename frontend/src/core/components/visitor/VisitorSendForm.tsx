import React, { useEffect, useState } from 'react';
import { departmentService, employeeService } from '../../services/adminService';
import SearchSelect from './SearchSelect';
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
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);

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
    setUnitsLoading(true);
    departmentService.getSubDepartments(departmentId)
      .then((res: { data?: unknown }) => active && setUnits(toOptions(res?.data)))
      .catch(() => active && setUnits([]))
      .finally(() => active && setUnitsLoading(false));
    return () => { active = false; };
  }, [departmentId]);

  useEffect(() => {
    setEmployeeId('');
    setEmployees([]);
    const target = unitId || departmentId;
    if (!target) return undefined;
    let active = true;
    setEmployeesLoading(true);
    employeeService.getByDepartment(target, true, 1, 100)
      .then((res: { data?: unknown }) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setEmployees(list.map((e: Record<string, unknown>) => ({ id: String(e._id), name: String(e.full_name || 'Unknown') })));
      })
      .catch(() => active && setEmployees([]))
      .finally(() => active && setEmployeesLoading(false));
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
        <SearchSelect
          options={departments}
          value={departmentId}
          onChange={setDepartmentId}
          disabled={disabled || loading}
          placeholder={loading ? 'Loading departments...' : 'Choose a department'}
          emptyText="No departments"
        />
      </div>
      <div>
        <label className={LABEL}>Unit</label>
        <SearchSelect
          options={units}
          value={unitId}
          onChange={setUnitId}
          disabled={disabled || !departmentId || (!unitsLoading && units.length === 0)}
          loading={unitsLoading}
          placeholder={unitsLoading ? 'Loading units...' : units.length ? 'Whole department' : 'No units'}
          emptyText="No units"
        />
      </div>
      <div>
        <label className={LABEL}>Employee</label>
        <SearchSelect
          options={employees}
          value={employeeId}
          onChange={setEmployeeId}
          disabled={disabled || !departmentId}
          loading={employeesLoading}
          placeholder={employeesLoading ? 'Loading employees...' : 'Anyone available'}
          emptyText="No employees"
        />
      </div>
      {noStaff ? <p className="sm:col-span-3 text-xs text-red-600">There is no employee in this {unitId ? 'unit' : 'department'} yet.</p> : null}
      {value ? <p className="sm:col-span-3 text-xs text-gray-500">Sending to {value.department_name}{value.provider_name ? `, ${value.provider_name}` : ''}.</p> : null}
    </div>
  );
};

export default VisitorSendForm;
