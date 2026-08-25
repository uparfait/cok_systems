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
    <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-gray-600">
        Total: <span className="font-medium">{totalRecords}</span> |{' '}
        Page <span className="font-medium">{currentPage}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm border border-gray-300 ppp-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 text-sm border ppp-lg transition-colors ${
              page === currentPage
                ? 'bg-[#056daa] text-white'
                : 'border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm border border-gray-300 ppp-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Forward
        </button>
      </div>
    </div>
  );
}
