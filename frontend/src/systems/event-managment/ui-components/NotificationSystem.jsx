import { useState } from "react";
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiX } from "react-icons/fi";

const CONFIG = {
  success: {
    title: "Success",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
    textClass: "text-green-800",
    iconClass: "text-green-600",
    btnClass: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    Icon: FiCheckCircle,
  },
  warning: {
    title: "Warning",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-800",
    iconClass: "text-amber-600",
    btnClass: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    Icon: FiAlertTriangle,
  },
  error: {
    title: "Something went wrong",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
    textClass: "text-red-800",
    iconClass: "text-red-600",
    btnClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    Icon: FiXCircle,
  },
};

const NotificationSystem = ({ level = "success", message }) => {
  const [show, setShow] = useState(true);

  if (!show) return null;

  const current = CONFIG[level] || CONFIG.success;
  const { title, bgClass, borderClass, textClass, iconClass, btnClass, Icon } = current;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-all duration-300">
      <div className="relative w-full max-w-sm overflow-hidden bg-white border border-gray-200 rounded-xl flex flex-col transition-all duration-200 transform scale-100 animate-in fade-in zoom-in-95">
        
       
        <div className={`h-1.5 w-full ${btnClass.split(' ')[0]}`} />

      
        <div className={`p-4 flex items-start gap-3 border-b ${borderClass} ${bgClass}`}>
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
          <div className="flex-1 min-w-0">
            <h1 className={`text-sm font-bold tracking-wide ${textClass}`}>
              {title}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-200/50 hover:text-gray-700 transition-colors"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

      
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-gray-600 break-words whitespace-pre-wrap">
            {message}
          </p>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setShow(false)}
              className={`w-full sm:w-auto px-5 py-2 rounded-lg font-medium text-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${btnClass}`}
            >
              Dismiss
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NotificationSystem;