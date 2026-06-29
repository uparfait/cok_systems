import { FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';

export default function Notification({ notification }) {
  if (!notification) return null;

  const isSuccess = notification.type === 'success';

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className={`flex items-center gap-3 px-4 py-3 border-2 shadow-lg ${
        isSuccess 
          ? 'bg-white border-[#1255e5] text-gray-900' 
          : 'bg-red-50 border-red-300 text-red-800'
      }`}>
        {isSuccess ? (
          <FiCheckCircle className="w-5 h-5 text-[#1255e5] flex-shrink-0" />
        ) : (
          <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
        <p className="text-sm font-medium">{notification.message}</p>
        <div className="w-1 h-1 rounded-full bg-current opacity-30 mx-1"></div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}