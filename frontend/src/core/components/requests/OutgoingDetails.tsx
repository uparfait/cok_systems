import { useState, useEffect, useRef } from 'react';
import { FiX, FiEdit3 } from 'react-icons/fi';
import outgoingService from '../../../core/services/outgoingService';
import type { OutgoingDoc } from '../../../core/services/outgoingService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { useToast } from '../../../core/contexts/ToastContext';

type OutgoingFormState = {
  reference_number: string;
  department_number: string;
  date_of_reception: string;
  date_of_recording: string;
  destination: string;
  subject: string;
  sign_by: string;
};

const OutgoingDetails: React.FC<{
  outgoing?: OutgoingDoc | null;
  requestId?: string;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ outgoing, requestId, onClose, onUpdate }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOutgoing, setCurrentOutgoing] = useState<OutgoingDoc | null>(outgoing || null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<OutgoingFormState>({
    reference_number: '',
    department_number: '',
    date_of_reception: '',
    date_of_recording: '',
    destination: '',
    subject: '',
    sign_by: '',
  });

  const initialFormRef = useRef<OutgoingFormState>(form);
  const isEdit = Boolean(currentOutgoing?._id);

  useEffect(() => {
    if (requestId && !outgoing) {
      loadOutgoingByRequest(requestId);
    } else if (outgoing) {
      setCurrentOutgoing(outgoing);
      const f: OutgoingFormState = {
        reference_number: outgoing.reference_number || '',
        department_number: outgoing.department_number || '',
        date_of_reception: outgoing.date_of_reception ? new Date(outgoing.date_of_reception).toISOString().split('T')[0] : '',
        date_of_recording: outgoing.date_of_recording ? new Date(outgoing.date_of_recording).toISOString().split('T')[0] : '',
        destination: outgoing.destination || '',
        subject: outgoing.subject || '',
        sign_by: outgoing.sign_by || '',
      };
      setForm(f);
      initialFormRef.current = f;
      setIsEditing(false);
    }
  }, [requestId, outgoing]);

  const loadOutgoingByRequest = async (reqId: string) => {
    setLoading(true);
    try {
      const res = await outgoingService.getByRequest(reqId);
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        const data = res.data as OutgoingDoc | null;
        setCurrentOutgoing(data);
        if (data) {
          const f: OutgoingFormState = {
            reference_number: data.reference_number || '',
            department_number: data.department_number || '',
            date_of_reception: data.date_of_reception ? new Date(data.date_of_reception).toISOString().split('T')[0] : '',
            date_of_recording: data.date_of_recording ? new Date(data.date_of_recording).toISOString().split('T')[0] : '',
            destination: data.destination || '',
            subject: data.subject || '',
            sign_by: data.sign_by || '',
          };
          setForm(f);
          initialFormRef.current = f;
        }
      }
    } catch (error) {
      setCurrentOutgoing(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const hasFieldChanged = (key: keyof OutgoingFormState) => {
    return form[key] !== initialFormRef.current[key];
  };

  const buildUpdatePayload = () => {
    const payload: any = {};
    if (hasFieldChanged('reference_number')) payload.reference_number = form.reference_number;
    if (hasFieldChanged('department_number')) payload.department_number = form.department_number;
    if (hasFieldChanged('date_of_reception')) payload.date_of_reception = form.date_of_reception || null;
    if (hasFieldChanged('date_of_recording')) payload.date_of_recording = form.date_of_recording || null;
    if (hasFieldChanged('destination')) payload.destination = form.destination;
    if (hasFieldChanged('subject')) payload.subject = form.subject;
    if (hasFieldChanged('sign_by')) payload.sign_by = form.sign_by;
    return payload;
  };

  const handleSave = async () => {
    if (!currentOutgoing?._id) return;
    const payload = buildUpdatePayload();
    if (Object.keys(payload).length === 0) {
      alert('No changes detected');
      return;
    }
    setLoading(true);
    try {
      await outgoingService.update(currentOutgoing._id, payload);
      setIsEditing(false);
      initialFormRef.current = form;
      onUpdate();
      showSuccess('Outgoing updated successfully');
      if (requestId) {
        loadOutgoingByRequest(requestId);
      }
    } catch (error) {
      console.error('Failed to update outgoing:', error);
      showError('Failed to update outgoing');
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (field: keyof OutgoingFormState, displayValue: string, type: 'text' | 'date' = 'text') => {
    if (isEditing) {
      const isReadOnly = field === 'reference_number';
      return (
        <input
          type={type}
          name={field}
          value={form[field]}
          onChange={handleChange}
          readOnly={isReadOnly}
          className="cok-auth-input w-full py-2.5 px-3 text-sm"
          style={{ fontFamily: "'Montserrat', sans-serif", backgroundColor: isReadOnly ? '#F7F9FB' : undefined }}
        />
      );
    }
    return <span className={displayValue === '-' ? 'text-gray-400' : ''}>{displayValue}</span>;
  };

  const rows: { label: string; field: keyof OutgoingFormState; value: string; type: 'text' | 'date' }[] = [
    { label: 'Reference Number', field: 'reference_number', value: form.reference_number || '-', type: 'text' },
    { label: 'Department Number', field: 'department_number', value: form.department_number || '-', type: 'text' },
    { label: 'Date of Reception', field: 'date_of_reception', value: form.date_of_reception ? new Date(form.date_of_reception).toLocaleDateString('en-GB') : '-', type: 'date' },
    { label: 'Date of Recording', field: 'date_of_recording', value: form.date_of_recording ? new Date(form.date_of_recording).toLocaleDateString('en-GB') : '-', type: 'date' },
    { label: 'Destination', field: 'destination', value: form.destination || '-', type: 'text' },
    { label: 'Subject', field: 'subject', value: form.subject || '-', type: 'text' },
    { label: 'Sign By', field: 'sign_by', value: form.sign_by || '-', type: 'text' },
  ];

  const hasChanges = Object.keys(buildUpdatePayload()).length > 0;
  const inputDisabled = isEdit && !isEditing;

  if (showCreateForm) {
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
              New Outgoing
            </h2>
            <button
              onClick={() => { setShowCreateForm(false); onClose(); }}
              className="cok-btn-outlined-reverse"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Department Number
                </label>
                <input
                  type="text"
                  value={form.department_number}
                  onChange={(e) => setForm({ ...form, department_number: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Date of Reception
                </label>
                <input
                  type="date"
                  value={form.date_of_reception}
                  onChange={(e) => setForm({ ...form, date_of_reception: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                  Date of Recording
                </label>
                <input
                  type="date"
                  value={form.date_of_recording}
                  onChange={(e) => setForm({ ...form, date_of_recording: e.target.value })}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
                Destination
              </label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
                placeholder="Optional"
              />
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
                Sign By
              </label>
              <input
                type="text"
                value={form.sign_by}
                onChange={(e) => setForm({ ...form, sign_by: e.target.value })}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const payload: any = {
                      reference_number: form.reference_number,
                      department_number: form.department_number,
                      date_of_reception: form.date_of_reception || null,
                      date_of_recording: form.date_of_recording || null,
                      destination: form.destination,
                      subject: form.subject,
                      sign_by: form.sign_by,
                    };
                    if (requestId) {
                      payload.request_id = requestId;
                    }
                     await outgoingService.create(payload);
                     showSuccess('Outgoing created successfully');
                     onUpdate();
                     setShowCreateForm(false);
                     onClose();
                     if (requestId) {
                       loadOutgoingByRequest(requestId);
                     }
                  } catch (error) {
                    console.error('Failed to create outgoing:', error);
                    showError('Failed to create outgoing');
                  } finally {
                    setLoading(false);
                  }
                }}
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
                onClick={() => { setShowCreateForm(false); onClose(); }}
                className="cok-btn-outlined"
                style={{ width: 'auto', padding: '0.7rem 1.2rem' }}
              >
                Cancel
              </button>
            </div>
            <button type="button" onClick={() => { setShowCreateForm(false); onClose(); }} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !currentOutgoing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white w-full max-w-2xl p-8" style={{ borderRadius: 0 }}>
          <SpiralLoader />
        </div>
      </div>
    );
  }

  if (!currentOutgoing && !requestId) {
    return null;
  }

  if (!currentOutgoing && requestId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Outgoing Details</h2>
            <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6 text-center py-12 text-sm text-gray-400">
            No outgoing recorded for this request yet
          </div>
          <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="cok-btn-primary"
              style={{ padding: '0.7rem 1.2rem' }}
            >
              Create Outgoing
            </button>
            <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
         <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Outgoing Details</h2>
          <div className="flex items-center gap-3">
            {isEdit && currentOutgoing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="relative cursor-pointer inline-flex h-6 w-11 items-center transition-colors"
                  style={{ borderRadius: 0 }}
                  aria-pressed={isEditing}
                >
                  <span className="inline-block z-5 h-5 w-5 cok-primary-bg transition-transform duration-200" style={{ transform: isEditing ? 'translateX(20px)' : 'translateX(2px)', borderRadius: 990 }} />
                  <span className="absolute inset-0 transition-colors duration-200" style={{ borderRadius: 200, backgroundColor: '#FFFFFF' }} />
                </button>
                <div className="text-white text-xs font-semibold uppercase mr-1" style={{ fontFamily: "var(--cok-font-heading)", minWidth: '54px', textAlign: 'center' }}>
                  {isEditing ? 'EDIT ON' : 'EDIT OFF'}
                </div>
              </>
            )}
            <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderRadius: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#F7F9FB' }}>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ width: '35%' }}>Field</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>{row.label}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#333333' }}>
                      {isEditing ? renderCell(row.field, row.value, row.type) : <span className={row.value === '-' ? 'text-gray-400' : ''}>{row.value}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
          {isEdit && isEditing && (
            <button type="button" onClick={handleSave} disabled={loading} className="cok-btn-primary flex max-h-[50px] flex-row items-center justify-center gap-2" style={{ width: 'auto', padding: '0.7rem 1.2rem' }}>
              {loading && <SpiralLoader color='#FFFFFF' />}
              Save
            </button>
          )}
          <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutgoingDetails;
