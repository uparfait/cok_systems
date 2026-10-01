import { useState, useEffect } from 'react';
import outgoingService from '../../../core/services/outgoingService';
import type { OutgoingDoc } from '../../../core/services/outgoingService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { useToast } from '../../../core/contexts/ToastContext';
import OverlayShell from '../overlay/OverlayShell';

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
    <OverlayShell
      title={outgoing ? 'Edit Outgoing' : 'New Outgoing'}
      onClose={onClose}
      busy={loading}
      width="lg"
      closeOnBackdrop={false}
      footer={
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
      }
    >
        <form onSubmit={handleSubmit} className="space-y-4">
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
    </OverlayShell>
  );
};

export default OutgoingForm;
