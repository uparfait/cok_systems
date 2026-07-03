import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface ModalPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

interface OverviewModalProps {
  title: string;
  data: any[];
  loading: boolean;
  pagination: ModalPagination;
  onClose: () => void;
  onPageChange: (page: number) => void;
  renderContent: () => React.ReactNode;
  chartId?: string;
  createChart?: (canvas: HTMLCanvasElement) => Chart;
}

const OverviewModal: React.FC<OverviewModalProps> = ({ title, loading, pagination, onClose, onPageChange, renderContent, chartId, createChart }) => {
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (chartId && createChart) {
      const canvas = document.getElementById(chartId) as HTMLCanvasElement;
      if (canvas) {
        if (chartRef.current) chartRef.current.destroy();
        chartRef.current = createChart(canvas);
      }
    }
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [chartId, createChart, data]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderContent()
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-sm">
            <span className="text-gray-600">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} items)</span>
            <div className="flex gap-2">
              <button onClick={() => onPageChange(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Prev</button>
              <button onClick={() => onPageChange(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewModal;