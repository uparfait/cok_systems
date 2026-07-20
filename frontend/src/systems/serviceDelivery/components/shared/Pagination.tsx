// Pagination - Reusable pagination component with multiple style options
import React from 'react';
import { FiArrowLeft, FiArrowRight, FiLoader } from 'react-icons/fi';

const fontHeading = "'Montserrat', sans-serif";

export type PaginationStyle = 'arrows-only' | 'arrows-with-numbers' | 'prev-next';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  style?: PaginationStyle;
  // Loading state
  isLoading?: boolean;
  // Display options
  showPageInfo?: boolean;
  itemsPerPage?: number;
  totalItems?: number;
  // Custom labels
  prevLabel?: string;
  nextLabel?: string;
  // Custom classes
  containerClassName?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  style = 'arrows-with-numbers',
  isLoading = false,
  showPageInfo = true,
  itemsPerPage = 5,
  totalItems,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  containerClassName = '',
  buttonClassName = '',
  activeButtonClassName = '',
}) => {
  // Don't render if there's only one page
  if (totalPages <= 1) return null;

  const handlePrevClick = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextClick = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Calculate showing info
  const showingFrom = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems || 0);
  const showingTo = Math.min(currentPage * itemsPerPage, totalItems || 0);

  // Common button classes
  const getButtonClasses = (isActive: boolean = false, isDisabled: boolean = false) => {
    const baseClasses = 'flex items-center justify-center transition-colors';
    const disabledClasses = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:text-[#9E9E9E]';

    if (isActive) {
      return `${baseClasses} ${activeButtonClassName || 'bg-[#056daa] text-white'} ${disabledClasses}`;
    }

    return `${baseClasses} ${buttonClassName || 'bg-white border border-[#E0E0E0] text-[#555555] hover:bg-gray-100'} ${disabledClasses}`;
  };

  // Style: Arrows Only (like in ProvideServicesTab)
  if (style === 'arrows-only') {
    return (
      <div className={`flex justify-between items-center mt-6 ${containerClassName}`}>
        {showPageInfo && (
          <div className="text-[#9E9E9E] text-[12px]">
            Page {currentPage} of {totalPages}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handlePrevClick}
            disabled={currentPage === 1 || isLoading}
            className={`flex items-center gap-1 h-8 px-3 text-[12px] ${getButtonClasses(false, currentPage === 1 || isLoading)}`}
            style={{ fontFamily: fontHeading, borderRadius: 0 }}
          >
            {isLoading ? (
              <FiLoader className="w-3 h-3 animate-spin" />
            ) : (
              <FiArrowLeft className="w-3 h-3" />
            )}
            {prevLabel}
          </button>
          <button
            onClick={handleNextClick}
            disabled={currentPage === totalPages || isLoading}
            className={`flex items-center gap-1 h-8 px-3 text-[12px] ${getButtonClasses(false, currentPage === totalPages || isLoading)}`}
            style={{ fontFamily: fontHeading, borderRadius: 0 }}
          >
            {nextLabel}
            {isLoading ? (
              <FiLoader className="w-3 h-3 animate-spin" />
            ) : (
              <FiArrowRight className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Style: Previous/Next with Page Numbers (like in EmployeeDashboardTab)
  if (style === 'arrows-with-numbers') {
    // Generate visible page numbers with ellipsis
    const getVisiblePages = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 3;

      if (totalPages <= maxVisible + 2) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);

        if (currentPage > 3) {
          pages.push('...');
        }

        // Show pages around current
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (currentPage < totalPages - 2) {
          pages.push('...');
        }

        // Always show last page
        pages.push(totalPages);
      }

      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <div className={`flex justify-between items-center pt-4 mt-2 ${containerClassName}`}>
        {showPageInfo && totalItems && (
          <p className="text-[#9E9E9E] text-[12px]">
            Showing <span className="font-bold">{showingFrom}</span>-<span className="font-bold">{showingTo}</span> of <span className="font-bold">{totalItems}</span> results
          </p>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevClick}
            disabled={currentPage === 1 || isLoading}
            className={`w-8 h-8 ${getButtonClasses(false, currentPage === 1 || isLoading)}`}
            style={{ borderRadius: 0 }}
          >
            {isLoading ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiArrowLeft className="w-4 h-4" />
            )}
          </button>

          {visiblePages.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="text-[#9E9E9E] px-1">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 text-[12px] font-medium ${getButtonClasses(isActive)}`}
                style={{ fontFamily: fontHeading, borderRadius: 0 }}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={handleNextClick}
            disabled={currentPage === totalPages || isLoading}
            className={`w-8 h-8 ${getButtonClasses(false, currentPage === totalPages || isLoading)}`}
            style={{ borderRadius: 0 }}
          >
            {isLoading ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiArrowRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Style: Prev/Next (like in DepartmentDashboardTab)
  if (style === 'prev-next') {
    // Generate fixed 3 page buttons for this style
    const pageButtons = Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1);

    return (
      <div className={`px-6 py-4 border-t border-[#E0E0E0] flex items-center justify-between ${containerClassName}`}>
        {showPageInfo && totalItems && (
          <p className="text-[13px] text-[#555555]">
            Showing {showingFrom} to {showingTo} of {totalItems} requests
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevClick}
            disabled={currentPage === 1 || isLoading}
            className={`w-7 h-7 ${getButtonClasses(false, currentPage === 1 || isLoading)}`}
            style={{ borderRadius: 0 }}
          >
            {isLoading ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiArrowRight className="w-4 h-4 text-[#555555] rotate-180" />
            )}
          </button>

          {pageButtons.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-7 h-7 text-[13px] font-medium transition-colors ${
                currentPage === page
                  ? 'bg-[#056daa] text-white'
                  : 'bg-white border border-[#E0E0E0] text-[#555555] hover:bg-gray-100'
              }`}
              style={{ fontFamily: fontHeading, borderRadius: 0 }}
            >
              {page}
            </button>
          ))}

          <button
            onClick={handleNextClick}
            disabled={currentPage === totalPages || isLoading}
            className={`w-7 h-7 ${getButtonClasses(false, currentPage === totalPages || isLoading)}`}
            style={{ borderRadius: 0 }}
          >
            {isLoading ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiArrowRight className="w-4 h-4 text-[#555555]" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Pagination;
