import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiClock, FiActivity } from 'react-icons/fi';
import { STATUSES, STATUS_META, cokInputStyle, cokBtnStyle } from './TaskDesignTokens';

export default function TaskProgressIndicator({ current, onUpdate }) {
  const currentIdx = STATUSES.indexOf(current);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(current);
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function toggle() {
    setOpen(o => !o);
    setChosen(current);
    setDesc('');
    setFile(null);
    setErr('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!desc.trim()) { setErr('Description is required.'); return; }
    if (chosen === current) { setErr('Please choose a different status.'); return; }
    setSaving(true);
    setErr('');
    try {
      await onUpdate(chosen, desc.trim(), file);
      setOpen(false);
      setDesc('');
      setFile(null);
    } catch (e) {
      setErr(e.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: `1px solid #E0E0E0`, borderRadius: 0, overflow: 'hidden', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
      <div style={{ padding: '20px 24px 16px' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontFamily: "'Montserrat', sans-serif" }}>Progress</p>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STATUSES.map((s, i) => {
            const m = STATUS_META[s];
            const Icon = m.icon;
            const done = i < currentIdx;
            const active = i === currentIdx;

            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={toggle}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="Click to update status"
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${done ? 'transparent' : active ? BORDER : '#E5E7EB'}`,
                    backgroundColor: done ? m.header : active ? '#FFFFFF' : '#F3F4F6',
                    color: done ? '#FFFFFF' : active ? m.text : '#D1D5DB',
                    boxShadow: active ? `0 0 0 2px ${m.text}33` : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                    {done ? <FiCheckCircle style={{ width: '16px', height: '16px' }} /> : <Icon style={{ width: '16px', height: '16px' }} />}
                  </div>
                  <span style={{
                    fontSize: active ? '12px' : '10px',
                    fontWeight: 600,
                    color: active ? m.text : done ? '#6B7280' : '#D1D5DB',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Montserrat', sans-serif"
                  }}>{s}</span>
                </button>

                {i < STATUSES.length - 1 && (
                  <div style={{ flex: 1, height: '2px', margin: '0 8px', borderRadius: '9999px', backgroundColor: i < currentIdx ? STATUS_META[STATUSES[i + 1]].header : '#E5E7EB', transition: 'background-color 0.2s' }} />
                )}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: '12px', color: '#9E9E9E', textAlign: 'center', marginTop: '12px', fontStyle: 'italic' }}>Click any step above to update the status</p>
      </div>

      {open && (
        <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #F3F4F6', padding: '16px 24px', backgroundColor: '#F7F9FB' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#333333', marginBottom: '16px', fontFamily: "'Montserrat', sans-serif" }}>Update Status</p>

          {err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}`, color: '#C62828', fontSize: '13px', borderRadius: 0, padding: '10px 12px', marginBottom: '12px' }}>
              <FiAlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />{err}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              const Icon = m.icon;
              const checked = chosen === s;
              return (
                <label
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: 0,
                    border: `2px solid ${checked ? m.border : '#E5E7EB'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: checked ? '#FFFFFF' : '#FFFFFF',
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={checked}
                    onChange={() => setChosen(s)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: `2px solid ${checked ? m.header : '#D1D5DB'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {checked && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: checked ? m.header : 'transparent' }} />}
                  </div>
                  <Icon style={{ width: '16px', height: '16px', flexShrink: 0, color: checked ? m.text : '#9E9E9E' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: checked ? m.text : '#6B7280', fontFamily: "'Montserrat', sans-serif" }}>{s}</span>
                  {s === current && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', backgroundColor: '#E5E7EB', color: '#6B7280', borderRadius: 0, padding: '2px 8px', fontWeight: 600 }}>Current</span>
                  )}
                </label>
              );
            })}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', fontFamily: "'Montserrat', sans-serif" }}>
              Description <span style={{ color: '#E74C3C' }}>*</span>
            </label>
            <textarea
              required
              rows={3}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe what was done or reason for this change…"
              style={{ ...cokInputStyle(), resize: 'none', backgroundColor: '#FFFFFF' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', fontFamily: "'Montserrat', sans-serif" }}>
              Attach Document <span style={{ color: '#9E9E9E', fontWeight: 400 }}>(optional)</span>
            </label>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#E6F4F9', border: `1px solid #BFDBFE`, borderRadius: 0 }}>
                <FiPaperclip style={{ width: '16px', height: '16px', color: '#056daa', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: '#1565C0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <button type="button" onClick={() => setFile(null)} style={{ padding: '4px', borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#60A5FA', flexShrink: 0 }}>
                  <FiX style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: `2px dashed #E5E7EB`, borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease', backgroundColor: '#FFFFFF' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: 0, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color 0.2s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Click to upload a file</p>
                  <p style={{ fontSize: '11px', color: '#9E9E9E', margin: '2px 0 0' }}>PDF, Word, Excel, Images</p>
                </div>
                <input
                  type="file"
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files[0] || null)}
                />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={toggle} style={{ flex: 1, padding: '10px', fontSize: '13px', color: '#6B7280', border: `1px solid #E5E7EB`, borderRadius: 0, backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'background-color 0.2s', fontFamily: "'Montserrat', sans-serif" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...cokBtnStyle(chosen === 'Completed' ? 'success' : 'primary', saving), flex: 1 }}>
              {saving ? 'Saving…' : `Set to ${chosen}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
