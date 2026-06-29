export default function RoomsPagination({ currentPage, totalPages, totalRecords, onPageChange }) {
  const getPageNumbers = () => {
    const pages = [];
    const total = totalPages;
    const current = currentPage;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    if (current <= 3) end = Math.min(5, total);
    if (current >= total - 2) start = Math.max(1, total - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex-shrink-0 bg-white border-t-2 border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-600 font-medium">
          Total Records: <span className="text-gray-900 font-bold">{totalRecords}</span>
          <span className="mx-2 text-gray-300">|</span>
          Page <span className="text-gray-900 font-bold">{currentPage}</span> of{' '}
          <span className="text-gray-900 font-bold">{totalPages}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-4 py-2 text-sm border-2 border-gray-300 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ← Back
          </button>

          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[40px] py-2 text-sm border-2 font-bold transition-all ${
                page === currentPage
                  ? 'bg-[#1255e5] text-white border-[#1255e5]'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 text-sm border-2 border-gray-300 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Forward →
          </button>
        </div>
      </div>
    </div>
  );
}