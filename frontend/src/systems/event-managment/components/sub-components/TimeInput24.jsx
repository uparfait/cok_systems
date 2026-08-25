const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const selectClass = 'w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base cursor-pointer';

export default function TimeInput24({ id, value, onChange, disabled = false, hasError = false }) {
  const [hour = '', minute = ''] = (value || '').split(':');

  const update = (h, m) => {
    if (!h && !m) {
      onChange('');
      return;
    }
    onChange(`${h || '00'}:${m || '00'}`);
  };

  const errorStyle = hasError ? { borderColor: '#E74C3C' } : undefined;

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        id={id}
        value={hour}
        disabled={disabled}
        onChange={(e) => update(e.target.value, minute)}
        className={selectClass}
        style={errorStyle}
        aria-label="Hour (24-hour)"
      >
        <option value="">HH</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select
        value={minute}
        disabled={disabled}
        onChange={(e) => update(hour, e.target.value)}
        className={selectClass}
        style={errorStyle}
        aria-label="Minute"
      >
        <option value="">MM</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
