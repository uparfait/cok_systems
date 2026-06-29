import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

export default function ErrorAlert({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="bg-red-50 border border-red-200 ppp-lg p-4">
      <div className="flex items-start gap-3">
        <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">Availability Check Failed</p>
          <p className="text-xs text-red-600 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium ppp-lg transition-colors"
            >
              <FiRefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}