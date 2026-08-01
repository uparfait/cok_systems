import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import outgoingService from '../../../core/services/outgoingService';
import type { OutgoingDoc } from '../../../core/services/outgoingService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { useToast } from '../../../core/contexts/ToastContext';

const OutgoingForm: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  outgoing?: OutgoingDoc | null;
  requestData?: Partial<OutgoingDoc>;
}> = ({ onClose, onSuccess, outgoing, requestData }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reference_number: outgoing?.reference_number || requestData?.reference_number || '',
    department_number: outgoing?.department_number || requestData?.department_number || '',
    date_of_reception: outgoing?.date_of_reception ? new Date(outgoing.date_of_reception).toISOString().split('T')[0] : (requestData?.date_of_reception ? new Date(requestData.date_of_reception).toISOString().split('T')[0] : ''),
    date_of_recording: outgoing?.date_of_recording ? new Date(outgoing.date_of_recording).toISOString().split('T')[0] : '',
    destination: outgoing?.destination || requestData?.destination || '',
    subject: outgoing?.subject || requestData?.subject || '',
    sign_by: outgoing?.sign_by || '',
    request_id: outgoing?.request_id || requestData?.request_id || '',
  });

  useEffect(() => {
    if (outgoing) {
      setForm({
        reference_number: outgoing.reference_number || '',
        department_number: outgoing.department_number || '',
        date_of_reception: outgoing.date_of_reception ? new Date(outgoing.date_of_reception).toISOString().split('T')[0] : '',
        date_of_recording: outgoing.date_of_recording ? new Date(outgoing.date_of_recording).toISOString().split('T')[0] : '',
        destination: outgoing.destination || '',
        subject: outgoing.subject || '',
        sign_by: outgoing.sign_by || '',
        request_id: outgoing.request_id || '',
      });
    }
  }, [outgoing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (form.request_id) {
        payload.request_id = form.request_id;
      }

      if (outgoing?._id) {
        await outgoingService.update(outgoing._id, payload);
        showSuccess('Outgoing updated successfully');
      } else {
        await outgoingService.create(payload);
        showSuccess('Outgoing created successfully');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save outgoing:', error);
      showError('Failed to save outgoing');
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
            {outgoing ? 'Edit Outgoing' : 'New Outgoing'}
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
            <textarea
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              rows={3}
              className="cok-auth-input w-full py-2.5 px-3 text-sm"
              style={{ fontFamily: "'Montserrat', sans-serif", resize: 'vertical' }}
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
        </div>
      </div>
    </div>
  );
};

export default OutgoingForm;
