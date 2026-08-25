const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WHITE = '#FFFFFF';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const inputClass = 'w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base';

const labelStyle = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.5px', lineHeight: '1.4', display: 'block',
  color: NEUTRAL_DARK, textTransform: 'uppercase', marginBottom: '8px',
};

const FORMATS = [
  { value: 'Physical', title: 'Physical', description: 'Held in a room at City of Kigali. You will select an available room.' },
  { value: 'Virtual', title: 'Virtual', description: 'Held online. You can paste a meeting link (optional) or describe how to join.' },
];

export default function EventFormatFields({ eventFormat, virtualLink, virtualDescription, onChange, linkError }) {
  const selected = eventFormat || 'Physical';

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <label style={labelStyle}>
          Event Format <span style={{ color: DANGER }}>*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORMATS.map((f) => {
            const active = selected === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onChange('eventFormat', f.value)}
                className="text-left p-4 transition-all duration-200 cursor-pointer"
                style={{
                  border: `2px solid ${active ? PRIMARY : BORDER}`,
                  backgroundColor: active ? 'rgba(5,109,170,0.06)' : WHITE,
                  borderRadius: 0,
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 shrink-0"
                    style={{
                      borderRadius: '50%',
                      border: `2px solid ${active ? PRIMARY : GRAY_DISABLED}`,
                      backgroundColor: active ? PRIMARY : WHITE,
                      boxShadow: active ? `inset 0 0 0 3px ${WHITE}` : 'none',
                    }}
                  />
                  <span className="text-sm font-bold" style={{ color: active ? PRIMARY : NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {f.title}
                  </span>
                </span>
                <span className="block text-xs mt-1.5" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  {f.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected === 'Virtual' && (
        <>
          <div className="space-y-2">
            <label htmlFor="virtualLink" style={labelStyle}>
              Meeting Link <span className="text-xs ml-1" style={{ color: GRAY_DISABLED, textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              type="url"
              id="virtualLink"
              value={virtualLink || ''}
              onChange={(e) => onChange('virtualLink', e.target.value)}
              placeholder="https://meet.google.com/..."
              className={inputClass}
              style={{ borderColor: linkError ? DANGER : undefined }}
            />
            {linkError && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{linkError}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="virtualDescription" style={labelStyle}>
              Joining Details <span className="text-xs ml-1" style={{ color: GRAY_DISABLED, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              id="virtualDescription"
              value={virtualDescription || ''}
              onChange={(e) => onChange('virtualDescription', e.target.value)}
              rows="2"
              placeholder="Describe the link or how participants will join..."
              className={inputClass}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
