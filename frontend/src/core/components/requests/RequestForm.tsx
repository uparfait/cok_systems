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
