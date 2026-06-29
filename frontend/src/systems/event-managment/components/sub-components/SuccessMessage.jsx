import { FiCheckCircle } from 'react-icons/fi';

export default function SuccessMessage({ show, message }) {
  if (!show) return null;

  return (
    <div className="bg-green-50 border border-green-200 ppp-lg p-4">
      <div className="flex items-start gap-3">
        <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-800">{message || 'Event created successfully!'}</p>
          <p className="text-xs text-green-600 mt-1">
            You can continue editing or view it in the events list.
          </p>
        </div>
      </div>
    </div>
  );
}