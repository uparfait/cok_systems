import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';

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
  }, [chartId, createChart]);

  return (
    <OverlayShell
      title={title}
      onClose={onClose}
      width="xl"
      footer={pagination.totalPages > 1 ? (
        <div className="w-full flex items-center justify-between text-sm">
          <span className="text-gray-600">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} items)</span>
          <div className="flex gap-2">
            <button onClick={() => onPageChange(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1} className="px-3 py-1 border border-[#056daa] bg-white text-[#056daa] font-semibold uppercase hover:bg-[#F7F9FB] disabled:opacity-50" style={{ letterSpacing: '1px' }}>Prev</button>
            <button onClick={() => onPageChange(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages} className="px-3 py-1 border border-[#056daa] bg-white text-[#056daa] font-semibold uppercase hover:bg-[#F7F9FB] disabled:opacity-50" style={{ letterSpacing: '1px' }}>Next</button>
          </div>
        </div>
      ) : undefined}
    >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-[#056daa] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderContent()
          )}
    </OverlayShell>
  );
};

export default OverviewModal;