import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import requestService, { type RequestDoc } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const RequestForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  request?: RequestDoc | null;
}> = ({ onClose, onSuccess, request }) => {
  const [loading, setLoading] = useState(false);
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
  });

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

  const inputStyle: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '14px',
    backgroundColor: '#F7F9FB',
    border: '1px solid transparent',
    borderRadius: 0,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
    color: '#333333',
  };

  const focusInput = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = '#056daa';
    e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
  };
  const blurInput = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'transparent';
    e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4"
          style={{ backgroundColor: '#056daa', borderRadius: 0 }}
        >
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {request ? 'Edit Request' : 'New Request'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
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
                onFocus={focusInput}
                onBlur={blurInput}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={inputStyle}
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
                onFocus={focusInput}
                onBlur={blurInput}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={inputStyle}
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
                onFocus={focusInput}
                onBlur={blurInput}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={inputStyle}
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
                onFocus={focusInput}
                onBlur={blurInput}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            className="border border-gray-200 p-4"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
              borderRadius: 0,
            }}
          >
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
                  onFocus={focusInput}
                  onBlur={blurInput}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={inputStyle}
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
                  onFocus={focusInput}
                  onBlur={blurInput}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={inputStyle}
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
                  onFocus={focusInput}
                  onBlur={blurInput}
                  className="cok-auth-input w-full py-2.5 px-3 text-sm"
                  style={inputStyle}
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
              onFocus={focusInput}
              onBlur={blurInput}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={inputStyle}
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
              onFocus={focusInput}
              onBlur={blurInput}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={inputStyle}
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
              onFocus={focusInput}
              onBlur={blurInput}
              rows={3}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
              style={{ borderRadius: 0, color: '#333333' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#056daa', borderRadius: 0 }}
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestForm;
