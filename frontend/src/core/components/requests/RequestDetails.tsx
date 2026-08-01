import { useState, useEffect, useRef } from 'react';
import { FiX, FiSend } from 'react-icons/fi';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

type FormState = {
  redaction_date: string;
  reference_number: string;
  reception_date: string;
  sender_name: string;
  sender_email: string;
  sender_telephone: string;
  recipient: string;
  subject: string;
  orientation: string;
  remarks: string;
};

const RequestDetails: React.FC<{
  request: RequestDoc;
  onClose: () => void;
  onUpdate: () => void;
  onOutgoingClick?: (request: RequestDoc) => void;
  onCreateOutgoingFromCompleted?: (request: RequestDoc) => void;
  outgoingLoading?: boolean;
}> = ({ request, onClose, onUpdate, onOutgoingClick, onCreateOutgoingFromCompleted, outgoingLoading }) => {
  const [loading, setLoading] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressReason, setProgressReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showCompletedPrompt, setShowCompletedPrompt] = useState(false);
  const [completedPromptLoading, setCompletedPromptLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    redaction_date: request.redaction_date ? new Date(request.redaction_date).toISOString().split('T')[0] : '',
    reference_number: request.reference_number || '',
    reception_date: request.reception_date ? new Date(request.reception_date).toISOString().split('T')[0] : '',
    sender_name: request.sender?.name || '',
    sender_email: request.sender?.email || '',
    sender_telephone: request.sender?.telephone || '',
    recipient: request.recipient || 'COK',
    subject: request.subject || '',
    orientation: request.orientation || '',
    remarks: request.remarks || '',
  });

  const initialFormRef = useRef<FormState>(form);
  const isEdit = Boolean(request._id);

  useEffect(() => {
    const f: FormState = {
      redaction_date: request.redaction_date ? new Date(request.redaction_date).toISOString().split('T')[0] : '',
      reference_number: request.reference_number || '',
      reception_date: request.reception_date ? new Date(request.reception_date).toISOString().split('T')[0] : '',
      sender_name: request.sender?.name || '',
      sender_email: request.sender?.email || '',
      sender_telephone: request.sender?.telephone || '',
      recipient: request.recipient || 'COK',
      subject: request.subject || '',
      orientation: request.orientation || '',
      remarks: request.remarks || '',
    };
    setForm(f);
    initialFormRef.current = f;
    setIsEditing(false);
  }, [request._id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const hasFieldChanged = (key: keyof FormState) => {
    return form[key] !== initialFormRef.current[key];
  };

  const buildUpdatePayload = () => {
    const payload: any = {};
    if (hasFieldChanged('redaction_date')) payload.redaction_date = form.redaction_date || null;
    if (hasFieldChanged('reference_number')) payload.reference_number = form.reference_number;
    if (hasFieldChanged('reception_date')) payload.reception_date = form.reception_date || null;
    if (hasFieldChanged('sender_name') || hasFieldChanged('sender_email') || hasFieldChanged('sender_telephone')) {
      payload.sender = {
        name: form.sender_name,
        email: form.sender_email,
        telephone: form.sender_telephone,
      };
    }
    if (hasFieldChanged('recipient')) payload.recipient = form.recipient;
    if (hasFieldChanged('subject')) payload.subject = form.subject;
    if (hasFieldChanged('orientation')) payload.orientation = form.orientation;
    if (hasFieldChanged('remarks')) payload.remarks = form.remarks;
    return payload;
  };

  const handleSave = async () => {
    if (!request._id) return;
    const payload = buildUpdatePayload();
    if (Object.keys(payload).length === 0) {
      alert('No changes detected');
      return;
    }
    setLoading(true);
    try {
      await requestService.update(request._id, payload);
      setIsEditing(false);
      initialFormRef.current = form;
      onUpdate();
    } catch (error) {
      console.error('Failed to update request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!request._id || !archiveReason.trim()) return;
    setLoading(true);
    try {
      await requestService.archive(request._id, archiveReason);
      onUpdate();
      setShowArchiveModal(false);
      onClose();
    } catch (error) {
      console.error('Failed to archive request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProgress = async () => {
    if (!request._id || !progressReason.trim()) return;
    setLoading(true);
    try {
      await requestService.update(request._id, { status: 'Inprogress' });
      onUpdate();
      setShowProgressModal(false);
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (field: keyof FormState, displayValue: string, type: 'text' | 'date' | 'textarea' = 'text') => {
    if (isEditing) {
      if (type === 'textarea') {
        return (
          <textarea
            name={field}
            value={form[field]}
            onChange={handleChange}
            rows={3}
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif", resize: 'vertical' }}
          />
        );
      }
      return (
        <input
          type={type}
          name={field}
          value={form[field]}
          onChange={handleChange}
          className="cok-auth-input w-full py-2.5 px-3 text-sm"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        />
      );
    }
    return <span className={displayValue === '-' ? 'text-gray-400' : ''}>{displayValue}</span>;
  };

  const renderSenderCell = () => {
    if (isEditing) {
      return (
        <div className="space-y-2">
          <input
            type="text"
            name="sender_name"
            value={form.sender_name}
            onChange={handleChange}
            placeholder="Name"
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          />
          <input
            type="email"
            name="sender_email"
            value={form.sender_email}
            onChange={handleChange}
            placeholder="Email"
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          />
          <input
            type="tel"
            name="sender_telephone"
            value={form.sender_telephone}
            onChange={handleChange}
            placeholder="Telephone"
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          />
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{request.sender?.name || '-'}</p>
        {request.sender?.email && <p className="text-xs text-gray-500">{request.sender.email}</p>}
        {request.sender?.telephone && <p className="text-xs text-gray-500">{request.sender.telephone}</p>}
      </div>
    );
  };

  const rows: { label: string; field: keyof FormState; value: string; type: 'text' | 'date' | 'textarea'; customRender?: () => React.ReactNode }[] = [
    { label: 'Redaction Date', field: 'redaction_date', value: form.redaction_date ? new Date(form.redaction_date).toLocaleDateString('en-GB') : '-', type: 'date' },
    { label: 'Reference Number', field: 'reference_number', value: form.reference_number || '-', type: 'text' },
    { label: 'Reception Date', field: 'reception_date', value: form.reception_date ? new Date(form.reception_date).toLocaleDateString('en-GB') : '-', type: 'date' },
    { label: 'Sender', field: 'sender_name', value: '', type: 'text', customRender: renderSenderCell },
    { label: 'Recipient', field: 'recipient', value: form.recipient || 'COK', type: 'text' },
    { label: 'Subject', field: 'subject', value: form.subject || '-', type: 'text' },
    { label: 'Orientation', field: 'orientation', value: form.orientation || '-', type: 'text' },
    { label: 'Remarks', field: 'remarks', value: form.remarks || '-', type: 'textarea' },
  ];

  const hasChanges = Object.keys(buildUpdatePayload()).length > 0;
  const inputDisabled = isEdit && !isEditing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Request Details</h2>
          <div className="flex items-center gap-3">
            {request.status === 'Completed' && onOutgoingClick && (
              <button
                type="button"
                onClick={() => !outgoingLoading && onOutgoingClick(request)}
                disabled={outgoingLoading}
                className="cok-btn-outlined flex items-center gap-1 text-xs font-semibold uppercase"
                style={{ padding: '0.4rem 0.8rem', borderColor: '#056daa', color: '#FFFFFF', backgroundColor: '#056daa' }}
              >
                {outgoingLoading ? (
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FFFFFF', borderTopColor: 'transparent' }}></div>
                ) : (
                  <FiSend className="w-3 h-3" />
                )}
                {outgoingLoading ? 'Loading...' : 'Outgoing'}
              </button>
            )}
            {isEdit && (
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
                      {isEditing ? (row.customRender ? row.customRender() : renderCell(row.field, row.value, row.type)) : (row.customRender ? row.customRender() : <span className={row.value === '-' ? 'text-gray-400' : ''}>{row.value}</span>)}
                    </td>
                  </tr>
                ))}
                {!isEditing && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>Status</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#333333' }}>
                      {statusLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#056daa', borderTopColor: 'transparent' }}></div>
                          <span className="text-xs" style={{ color: '#056daa' }}>Updating...</span>
                        </div>
                      ) : (
                        <select
                          value={request.status || 'Pending'}
                          onChange={(e) => {
                            const newStatus = e.target.value as 'Pending' | 'Inprogress' | 'Completed' | 'Archived' | 'Overdue';
                            if (newStatus === request.status) return;
                            setStatusLoading(true);
                            if (newStatus === 'Archived') {
                              setShowArchiveModal(true);
                              setStatusLoading(false);
                            } else if (newStatus === 'Inprogress') {
                              setShowProgressModal(true);
                              setStatusLoading(false);
                            } else if (newStatus === 'Completed' && request.status !== 'Completed') {
                              setShowCompletedPrompt(true);
                              setStatusLoading(false);
                            } else {
                              requestService.update(request._id, { status: newStatus }).then(() => {
                                onUpdate();
                                setStatusLoading(false);
                              }).catch(() => setStatusLoading(false));
                            }
                          }}
                          className="cok-auth-input w-full py-2.5 px-3 text-sm"
                          style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Inprogress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Archived">Archived</option>
                          <option value="Overdue">Overdue</option>
                        </select>
                      )}
                    </td>
                  </tr>
                )}
                {request.status === 'Archived' && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>Archive Reason</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#333333' }}>{request.archive_reason || '-'}</td>
                  </tr>
                )}
                {request.status_reason && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>Status Reason</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#333333' }}>{request.status_reason}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
          {isEdit && isEditing && (
            <button type="button" onClick={handleSave} disabled={loading} className="cok-btn-primary flex max-h-[50px] flex-row items-center justify-center gap-2" style={{ width: 'auto', padding: '0.7rem 1.2rem' }}>
              {loading && <SpiralLoader color='#FFFFFF'/>}
              Save
            </button>
          )}
          <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
            Close
          </button>
        </div>
      </div>

      {showArchiveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md p-6" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>Archive Request</h3>
            <p className="text-sm text-gray-600 mb-4">Please provide a reason for archiving this request.</p>
            <textarea value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Enter archive reason" rows={4} className="cok-auth-input w-full mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }} />
            <div className="flex gap-2">
              <button onClick={() => setShowArchiveModal(false)} className="cok-btn-outlined flex-1" style={{ padding: '0.7rem 1.2rem' }}>Cancel</button>
              <button onClick={handleArchive} disabled={loading || !archiveReason.trim()} className="cok-btn-primary flex-1 disabled:opacity-50" style={{ padding: '0.7rem 1.2rem', backgroundColor: '#E53935' }}>
                {loading ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md p-6" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>Mark as In Progress</h3>
            <p className="text-sm text-gray-600 mb-4">Please provide a reason for marking this request as in progress.</p>
            <textarea value={progressReason} onChange={(e) => setProgressReason(e.target.value)} placeholder="Enter reason" rows={4} className="cok-auth-input w-full mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }} />
            <div className="flex gap-2">
              <button onClick={() => setShowProgressModal(false)} className="cok-btn-outlined flex-1" style={{ padding: '0.7rem 1.2rem' }}>Cancel</button>
              <button onClick={handleProgress} disabled={loading || !progressReason.trim()} className="cok-btn-primary flex-1 disabled:opacity-50" style={{ padding: '0.7rem 1.2rem', backgroundColor: '#F39C12' }}>
                {loading ? 'Saving...' : 'Mark In Progress'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompletedPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md p-6" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>Mark as Completed</h3>
            <p className="text-sm text-gray-600 mb-4">Do you want to create an outgoing correspondence for this request?</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowCompletedPrompt(false); onCreateOutgoingFromCompleted?.(request); }} className="cok-btn-outlined flex-1" style={{ padding: '0.7rem 1.2rem' }} disabled={completedPromptLoading}>
                Create Outgoing
              </button>
              <button onClick={() => {
                setCompletedPromptLoading(true);
                requestService.update(request._id, { status: 'Completed' }).then(() => {
                  setShowCompletedPrompt(false);
                  setCompletedPromptLoading(false);
                  onUpdate();
                }).catch(() => {
                  setCompletedPromptLoading(false);
                });
              }} className="cok-btn-primary flex-1" style={{ padding: '0.7rem 1.2rem' }} disabled={completedPromptLoading}>
                {completedPromptLoading ? 'Updating...' : 'Just Move to Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetails;
