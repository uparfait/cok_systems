import { FiLoader } from 'react-icons/fi';

// City of Kigali design rule palette (see desegin_rule.html)
export const COK = {
  primary: '#056daa',
  primaryDark: '#045d94',
  success: '#4CAF50',
  warning: '#F39C12',
  danger: '#E53935',
  tertiary: '#CDB896',
  neutralDark: '#333333',
  neutralLight: '#F7F9FB',
  border: '#E0E0E0',
  headingFont: "'Montserrat', sans-serif",
  bodyFont: "'Merriweather', serif",
};

export const CokLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="uppercase"
    style={{
      fontFamily: COK.headingFont,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.5px',
      color: COK.neutralDark,
      margin: 0,
    }}
  >
    {children}
  </p>
);

export const CokLoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
    <FiLoader className="w-5 h-5 animate-spin" style={{ color: COK.primary }} />
  </div>
);

export const CokPageHeader = ({ title }: { title: string}) => (
  <div>
    <h1
      style={{
        fontFamily: COK.headingFont,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: '-0.5px',
        color: COK.primary,
        margin: 0,
      }}
    >
      {title}
    </h1>
    <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: COK.bodyFont, margin: '4px 0 0 0' }}>
    </p>
  </div>
);

export const CokStatCard = ({
  label,
  value,
  accent,
  icon,
  loading,
  sub,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: React.ReactNode;
  loading?: boolean;
  sub?: string;
}) => (
  <div
    className="bg-white p-4 relative transition-shadow duration-200 hover:shadow-md"
    style={{ border: `1px solid ${COK.border}` }}
  >
    {loading && <CokLoadingOverlay />}
    <div className="flex items-center justify-between" style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 10 }}>
      <div className="min-w-0">
        <CokLabel>{label}</CokLabel>
        <p
          className="mt-1"
          style={{ fontFamily: COK.headingFont, fontSize: 26, fontWeight: 700, color: COK.neutralDark, margin: 0 }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs text-gray-400 truncate" style={{ margin: '2px 0 0 0' }}>{sub}</p>
        )}
      </div>
      <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1A` }}>
        {icon}
      </div>
    </div>
  </div>
);

export const CokBadge = ({ label, color }: { label: string; color: string }) => (
  <span
    className="inline-block px-2 py-0.5 text-white uppercase whitespace-nowrap"
    style={{
      backgroundColor: color,
      fontFamily: COK.headingFont,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.5px',
    }}
  >
    {label}
  </span>
);

// Table header 
// in the CoK primary color
export const CokTh = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
  <th
    className={`px-4 py-3.5 ${center ? 'text-center' : 'text-left'} text-xs font-bold uppercase tracking-widest border-r last:border-r-0`}
    style={{ backgroundColor: COK.primary, color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.3)', fontFamily: COK.headingFont }}
  >
    {children}
  </th>
);

export const CokTableEmpty = ({ message }: { message: string }) => (
  <div className="w-full flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="text-sm font-medium text-gray-400 uppercase tracking-wide" style={{ fontFamily: COK.headingFont }}>
        {message}
      </span>
    </div>
  </div>
);

// Pagination bar styled like the event manager's Rooms pagination, in CoK colors
export const CokPagination = ({
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
}) => {
  const getPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (currentPage <= 3) end = Math.min(5, totalPages);
    if (currentPage >= totalPages - 2) start = Math.max(1, totalPages - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex-shrink-0 bg-white p-4" style={{ borderTop: `2px solid ${COK.border}` }}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-600 font-medium" style={{ fontFamily: COK.headingFont }}>
          Total Records: <span className="font-bold" style={{ color: COK.neutralDark }}>{totalRecords}</span>
          <span className="mx-2 text-gray-300">|</span>
          Page <span className="font-bold" style={{ color: COK.neutralDark }}>{currentPage}</span> of{' '}
          <span className="font-bold" style={{ color: COK.neutralDark }}>{totalPages}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ border: `2px solid ${COK.border}`, fontFamily: COK.headingFont, color: COK.neutralDark }}
          >
            Back
          </button>

          {getPageNumbers().map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className="min-w-[40px] py-2 text-sm font-bold transition-all"
              style={
                page === currentPage
                  ? { backgroundColor: COK.primary, color: '#FFFFFF', border: `2px solid ${COK.primary}`, fontFamily: COK.headingFont }
                  : { border: `2px solid ${COK.border}`, color: '#555555', fontFamily: COK.headingFont }
              }
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ border: `2px solid ${COK.border}`, fontFamily: COK.headingFont, color: COK.neutralDark }}
          >
            Forward 
          </button>
        </div>
      </div>
    </div>
  );
};

export const CokTab = ({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-2 text-xs transition-colors whitespace-nowrap"
    style={{
      fontFamily: COK.headingFont,
      fontWeight: 600,
      letterSpacing: '0.3px',
      color: active ? COK.primaryDark : '#666666',
      borderBottom: active ? `2px solid ${COK.primary}` : '2px solid transparent',
      backgroundColor: active ? '#EAF6FC' : 'transparent',
    }}
  >
    {label}
    {typeof count === 'number' && (
      <span
        className="ml-1.5 inline-flex items-center justify-center px-1.5 rounded-full text-[10px]"
        style={{ backgroundColor: active ? COK.primary : '#EEEEEE', color: active ? '#FFF' : '#666' }}
      >
        {count}
      </span>
    )}
  </button>
);
