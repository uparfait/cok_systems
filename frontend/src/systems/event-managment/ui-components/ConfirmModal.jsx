import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  loading = false,
}) {
  if (!isOpen) return null;

  const confirmStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 p-6 max-w-md w-full shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${
            confirmVariant === "danger" ? "bg-red-100" :
            confirmVariant === "success" ? "bg-green-100" :
            confirmVariant === "warning" ? "bg-yellow-100" : "bg-blue-100"
          }`}>
            {confirmVariant === "danger" ? (
              <FiAlertCircle className={`w-5 h-5 ${
                confirmVariant === "danger" ? "text-red-600" :
                confirmVariant === "success" ? "text-green-600" :
                confirmVariant === "warning" ? "text-yellow-600" : "text-blue-600"
              }`} />
            ) : (
              <FiCheckCircle className={`w-5 h-5 ${
                confirmVariant === "danger" ? "text-red-600" :
                confirmVariant === "success" ? "text-green-600" :
                confirmVariant === "warning" ? "text-yellow-600" : "text-blue-600"
              }`} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${confirmStyles[confirmVariant] || confirmStyles.primary}`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}