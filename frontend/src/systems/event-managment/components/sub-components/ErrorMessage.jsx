import { FiAlertCircle } from 'react-icons/fi';

export default function ErrorMessage({ message }) {
  if (!message) return null;

  return (
    <div className="bg-red-50 border border-red-200 ppp-lg p-3 flex items-center gap-2">
      <FiAlertCircle className="w-4 h-4 text-red-600 shrink-0" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}