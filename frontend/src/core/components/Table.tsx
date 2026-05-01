import React from 'react';
import { FiLoader, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export interface TableHeader {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean;
}

export interface TablePagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export interface TableProps {
  headers: TableHeader[];
  data: any[];
  loading?: boolean;
  pagination?: TablePagination;
  onRowClick?: (row: any, index: number) => void;
  rowClassName?: (row: any, index: number) => string;
  emptyMessage?: string;
  renderCell?: (header: TableHeader, row: any, index: number) => React.ReactNode;
  maxHeight?: string;
  minWidth?: string;
  className?: string;
}

const Table: React.FC<TableProps> = ({
  headers,
  data,
  loading = false,
  pagination,
  onRowClick,
  rowClassName,
  emptyMessage = 'No data found',
  renderCell,
  maxHeight = '400px',
  minWidth = '800px',
  className = ''
}) => {
  const navigate = useNavigate();

  const handleRowClick = (row: any, index: number) => {
    if (onRowClick) {
      onRowClick(row, index);
    }
  };

  const renderTableCell = (header: TableHeader, row: any, rowIndex: number) => {
    if (renderCell) {
      return renderCell(header, row, rowIndex);
    }

    const value = row[header.key];
    return (
      <span className="text-sm text-gray-900">
        {value || '-'}
      </span>
    );
  };

  const getRowClassName = (row: any, index: number) => {
    let baseClass = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';

    if (onRowClick) {
      baseClass += ' cursor-pointer';
    }

    if (rowClassName) {
      baseClass += ' ' + rowClassName(row, index);
    }

    return baseClass;
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Table Container with Scrolling */}
      <div
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight, minWidth }}
      >
        <table className="w-full">
          {/* Header */}
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header.key || index}
                  className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${header.className || ''}`}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center">
                  <div className="flex justify-center items-center gap-3">
                    <FiLoader className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-gray-500">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row._id || row.id || rowIndex}
                  className={getRowClassName(row, rowIndex)}
                  onClick={() => handleRowClick(row, rowIndex)}
                >
                  {headers.map((header, colIndex) => (
                    <td key={header.key || colIndex} className="px-6 py-4">
                      {renderTableCell(header, row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-sm text-gray-600">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalCount)} of{' '}
            {pagination.totalCount} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1 || pagination.loading}
              className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1 transition-colors"
            >
              {pagination.loading && (
                <FiLoader className="w-3 h-3 animate-spin" />
              )}
              <FiChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-sm text-gray-600 px-3 py-1">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages || pagination.loading}
              className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1 transition-colors"
            >
              Next
              <FiChevronRight className="w-4 h-4" />
              {pagination.loading && (
                <FiLoader className="w-3 h-3 animate-spin" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;