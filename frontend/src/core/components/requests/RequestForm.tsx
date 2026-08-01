import { useState, useEffect, useRef } from 'react';
import { FiX, FiUsers, FiUser } from 'react-icons/fi';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import { departmentService, employeeService } from '../../../core/services/adminService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import LoadingSpinner from '../../../core/components/LoadingSpinner';

const RequestForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  request?: RequestDoc | null;
}> = ({ onClose, onSuccess, request }) => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; telephone?: string; email?: string }[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [unitLoading, setUnitLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  const deptRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const empRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    redaction_date: request?.redaction_date ? new Date(request.redaction_date).toISOString().split('T')[0] : '',
    reference_number: request?.reference_number || '',
    reception_date: request?.reception_date ? new Date(request.reception_date).toISOString().split('T')[0] : '',
    sender_name: request?.sender?.name || '',
    sender_email: request?.sender?.email || '',
    sender_telephone: request?.sender?.telephone || '',
    recipient: request?.recipient || 'COK',
    subject: request?.subject || '',
    orientation: request?.orientation || '',
    remarks: request?.remarks || '',
    department_id: request?.department?._id || '',
    department_name: request?.department?.name || '',
    department_unit_id: request?.department_unit?._id || '',
    department_unit_name: request?.department_unit?.name || '',
    employee_id: request?.employee?._id || '',
    employee_name: request?.employee?.name || '',
    employee_telephone: request?.employee?.telephone || '',
    employee_email: request?.employee?.email || '',
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) setDeptOpen(false);
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) setUnitOpen(false);
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (!form.department_id) {
      setUnits([]);
      setForm((f) => ({ ...f, department_unit_id: '', department_unit_name: '' }));
      return;
    }
    loadUnits(form.department_id);
    setForm((f) => ({ ...f, department_unit_id: '', department_unit_name: '' }));
  }, [form.department_id]);

  useEffect(() => {
    if (!form.department_id) return;
    loadEmployees();
  }, [form.department_id, form.department_unit_id]);

  const loadDepartments = async () => {
    setDeptLoading(true);
    try {
      const res = await departmentService.getAll();
      if (res?.success && Array.isArray(res.data)) {
        const list = res.data
          .filter((d: any) => !d.sub_department_mng?.is_sub_department && !d.is_unit)
          .map((d: any) => ({
            id: d._id || d.department_id,
            name: d.department_name || d.name,
          }));
        setDepartments(list);
      }
    } catch {
      // keep existing departments
    } finally {
      setDeptLoading(false);
    }
  };

  const loadUnits = async (deptId: string) => {
    setUnitLoading(true);
    try {
      const res = await departmentService.getSubDepartments(deptId);
      let list: { id: string; name: string }[] = [];
      if (res?.success && Array.isArray(res.data)) {
        list = res.data.map((d: any) => ({
          id: d._id || d.department_id,
          name: d.department_name || d.name,
        }));
      }
      setUnits(list);
    } catch {
      // keep existing units
    } finally {
      setUnitLoading(false);
    }
  };

  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const targetId = form.department_unit_id || form.department_id;
      if (!targetId) return;
      const res = await employeeService.getByDepartment(targetId, true, 1, 100);
      if (res?.success && Array.isArray(res.data)) {
        setEmployees(
          res.data.map((e: any) => ({
            id: e._id,
            name: e.full_name || 'Unknown',
            telephone: e.telephone || '',
            email: e.email || '',
          }))
        );
      } else {
        setEmployees([]);
      }
    } catch {
      setEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  };

  const filteredDepts = departments.filter((d) => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
  const filteredUnits = units.filter((u) => u.name.toLowerCase().includes(unitSearch.toLowerCase()));
  const filteredEmps = employees.filter((e) => e.name.toLowerCase().includes(empSearch.toLowerCase()));

  const selectedDeptObj = departments.find((d) => d.id === form.department_id);
  const selectedUnitObj = units.find((u) => u.id === form.department_unit_id);
  const selectedEmpObj = employees.find((e) => e.id === form.employee_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        redaction_date: form.redaction_date || null,
        reference_number: form.reference_number,
        reception_date: form.reception_date || null,
        sender: {
          name: form.sender_name,
          email: form.sender_email,
          telephone: form.sender_telephone,
        },
        recipient: form.recipient,
        subject: form.subject,
        orientation: form.orientation,
        remarks: form.remarks,
        department: form.department_id
          ? { _id: form.department_id, name: form.department_name }
          : {},
        department_unit: form.department_unit_id
          ? { _id: form.department_unit_id, name: form.department_unit_name }
          : {},
        employee: form.employee_id && selectedEmpObj
          ? { _id: form.employee_id, name: selectedEmpObj.name, telephone: selectedEmpObj.telephone, email: selectedEmpObj.email }
          : {},
      };

      if (request?._id) {
        await requestService.update(request._id, payload);
      } else {
        await requestService.create(payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save request:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary"
          style={{ borderRadius: 0 }}
        >
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {request ? 'Edit Request' : 'New Request'}
          </h2>
          <button
            onClick={onClose}
            className="cok-btn-outlined-reverse"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                Redaction Date
              </label>
              <input
                type="date"
                value={form.redaction_date}
                onChange={(e) => setForm({ ...form, redaction_date: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                Reference Number
              </label>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                Reception Date
              </label>
              <input
                type="date"
                value={form.reception_date}
                onChange={(e) => setForm({ ...form, reception_date: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                Recipient
              </label>
              <input
                type="text"
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
          </div>

          <div className="border border-gray-200 p-4" style={{ borderRadius: 0 }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: '#056daa', fontFamily: "'Montserrat', sans-serif" }}>
              Sender Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={form.sender_email}
                  onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Telephone
                </label>
                <input
                  type="tel"
                  value={form.sender_telephone}
                  onChange={(e) => setForm({ ...form, sender_telephone: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
              Subject
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
              Orientation
            </label>
            <input
              type="text"
              value={form.orientation}
              onChange={(e) => setForm({ ...form, orientation: e.target.value })}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
              Remarks
            </label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              rows={3}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif", resize: 'vertical' }}
              placeholder="Optional"
            />
          </div>

          <div className="border border-gray-200 p-4" style={{ borderRadius: 0 }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: '#056daa', fontFamily: "'Montserrat', sans-serif" }}>
              Assignment Information
            </p>
            <div className="space-y-4">
              <div ref={deptRef} className="relative">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Department
                </label>
                {form.department_id && selectedDeptObj ? (
                  <div
                    className="cok-auth-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FiUsers className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      <span className="text-sm font-medium truncate" style={{ color: '#333333' }} title={selectedDeptObj.name}>
                        {selectedDeptObj.name}
                      </span>
                    </div>
                     <button
                       type="button"
                       onClick={() => { setDeptSearch(''); setDeptOpen(true); }}
                       className="cok-btn-outlined text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                       style={{ padding: '0.2rem 0.6rem' }}
                     >
                       Change
                     </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#9CA3AF]">
                        <FiUsers className="h-5 w-5" />
                      </span>
                      <input
                        value={deptSearch}
                        onChange={(e) => { setDeptSearch(e.target.value); setDeptOpen(true); }}
                        onFocus={() => setDeptOpen(true)}
                        className="cok-auth-input w-full py-2.5 px-3 text-sm"
                        style={{ paddingLeft: '2.5rem', fontFamily: "'Montserrat', sans-serif" }}
                        placeholder="Search department..."
                      />
                      {deptLoading && (
                        <div className="absolute right-2 top-2">
                          <LoadingSpinner size="sm" showMessage={false} />
                        </div>
                      )}
                    </div>
                    {deptOpen && (
                      <div
                        className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                        style={{ borderColor: '#E0E0E0', borderRadius: 0, position: 'absolute' }}
                      >
                        {filteredDepts.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No results</div>
                        ) : (
                          filteredDepts.map((d) => (
                            <div
                              key={d.id}
                              onClick={() => { setForm((f) => ({ ...f, department_id: d.id, department_name: d.name })); setDeptSearch(d.name); setDeptOpen(false); }}
                              className={`px-3 py-2 cursor-pointer text-sm ${d.id === form.department_id ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                              title={d.name}
                            >
                              {d.name}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div ref={unitRef} className="relative">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Unit {form.department_unit_name ? '' : '(Optional)'}
                </label>
                {form.department_unit_id && selectedUnitObj ? (
                  <div
                    className="cok-auth-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FiUsers className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      <span className="text-sm font-medium truncate" style={{ color: '#333333' }} title={selectedUnitObj.name}>
                        {selectedUnitObj.name}
                      </span>
                    </div>
                     <button
                       type="button"
                       onClick={() => { setForm((f) => ({ ...f, department_unit_id: '', department_unit_name: '' })); setUnitSearch(''); setUnitOpen(true); }}
                       className="cok-btn-outlined text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                       style={{ padding: '0.2rem 0.6rem' }}
                     >
                       Change
                     </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#9CA3AF]">
                        <FiUsers className="h-5 w-5" />
                      </span>
                      <input
                        value={unitSearch}
                        onChange={(e) => { setUnitSearch(e.target.value); setUnitOpen(true); }}
                        onFocus={() => form.department_id && setUnitOpen(true)}
                        disabled={!form.department_id}
                        className="cok-auth-input w-full py-2.5 px-3 text-sm"
                        style={{ paddingLeft: '2.5rem', fontFamily: "'Montserrat', sans-serif" }}
                        placeholder={form.department_id ? 'Search unit or none...' : 'Select department first'}
                      />
                      {unitLoading && (
                        <div className="absolute right-2 top-2">
                          <LoadingSpinner size="sm" showMessage={false} />
                        </div>
                      )}
                    </div>
                    {unitOpen && form.department_id && (
                      <div
                        className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                        style={{ borderColor: '#E0E0E0', borderRadius: 0, position: 'absolute' }}
                      >
                        <div
                          onClick={() => { setForm((f) => ({ ...f, department_unit_id: '', department_unit_name: '' })); setUnitSearch(''); setUnitOpen(false); }}
                          className={`px-3 py-2 cursor-pointer text-sm ${!form.department_unit_id ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          No specific unit
                        </div>
                        {filteredUnits.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => { setForm((f) => ({ ...f, department_unit_id: u.id, department_unit_name: u.name })); setUnitSearch(u.name); setUnitOpen(false); }}
                            className={`px-3 py-2 cursor-pointer text-sm ${u.id === form.department_unit_id ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                            title={u.name}
                          >
                            {u.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div ref={empRef} className="relative">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Assign to Employee {form.employee_name ? '' : '(Optional)'}
                </label>
                {form.employee_id && selectedEmpObj ? (
                  <div
                    className="cok-auth-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FiUser className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                      <span className="text-sm font-medium truncate" style={{ color: '#333333' }} title={selectedEmpObj.name}>
                        {selectedEmpObj.name}
                      </span>
                    </div>
                     <button
                       type="button"
                       onClick={() => { setForm((f) => ({ ...f, employee_id: '', employee_name: '', employee_telephone: '', employee_email: '' })); setEmpSearch(''); setEmpOpen(true); }}
                       className="cok-btn-outlined text-xs font-semibold uppercase px-2 py-1 flex-shrink-0"
                       style={{ padding: '0.2rem 0.6rem' }}
                     >
                       Change
                     </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#9CA3AF]">
                        <FiUser className="h-5 w-5" />
                      </span>
                      <input
                        value={empSearch}
                        onChange={(e) => { setEmpSearch(e.target.value); setEmpOpen(true); }}
                        onFocus={() => form.department_id && setEmpOpen(true)}
                        disabled={!form.department_id}
                        className="cok-auth-input w-full py-2.5 px-3 text-sm"
                        style={{ paddingLeft: '2.5rem', fontFamily: "'Montserrat', sans-serif" }}
                        placeholder={form.department_id ? 'Search employee or none...' : 'Select department first'}
                      />
                      {empLoading && (
                        <div className="absolute right-2 top-2">
                          <LoadingSpinner size="sm" showMessage={false} />
                        </div>
                      )}
                    </div>
                    {empOpen && form.department_id && (
                      <div
                        className="left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border"
                        style={{ borderColor: '#E0E0E0', borderRadius: 0, position: 'absolute' }}
                      >
                        <div
                          onClick={() => { setForm((f) => ({ ...f, employee_id: '', employee_name: '', employee_telephone: '', employee_email: '' })); setEmpSearch(''); setEmpOpen(false); }}
                          className={`px-3 py-2 cursor-pointer text-sm ${!form.employee_id ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          No specific employee
                        </div>
                        {filteredEmps.map((e) => (
                          <div
                            key={e.id}
                            onClick={() => { setForm((f) => ({ ...f, employee_id: e.id, employee_name: e.name, employee_telephone: e.telephone || '', employee_email: e.email || '' })); setEmpSearch(e.name); setEmpOpen(false); }}
                            className={`px-3 py-2 cursor-pointer text-sm ${e.id === form.employee_id ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                            title={e.name}
                          >
                            {e.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="cok-btn-primary flex max-h-[50px] flex-row items-center justify-center gap-2"
              style={{ padding: '0.7rem 1.2rem', width: 'auto' }}
            >
              {loading ? (
                <>
                  <SpiralLoader color="#FFFFFF" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cok-btn-outlined"
              style={{ width: 'auto', padding: '0.7rem 1.2rem' }}
            >
              Cancel
            </button>
          </div>
          <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestForm;
