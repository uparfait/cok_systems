import React from 'react';
import { FiPlus } from 'react-icons/fi';

interface AddCardProps {
  title: string;
  description?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'blue' | 'green' | 'purple' | 'orange';
}

const AddCard: React.FC<AddCardProps> = ({
  title,
  description,
  onClick,
  icon,
  variant = 'blue'
}) => {
  const variantStyles = {
    default: {
      bg: 'bg-white',
      border: 'border-2 border-dashed border-gray-300 hover:border-blue-400',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hover: 'hover:bg-blue-50 hover:shadow-md',
      gradient: ''
    },
    blue: {
      bg: 'bg-white',
      border: 'border-2 border-dashed border-blue-200 hover:border-blue-400',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconColor: 'text-white',
      hover: 'hover:shadow-lg hover:scale-[1.02]',
      gradient: 'bg-gradient-to-br from-blue-50 to-indigo-50'
    },
    green: {
      bg: 'bg-white',
      border: 'border-2 border-dashed border-emerald-200 hover:border-emerald-400',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
      iconColor: 'text-white',
      hover: 'hover:shadow-lg hover:scale-[1.02]',
      gradient: 'bg-gradient-to-br from-emerald-50 to-green-50'
    },
    purple: {
      bg: 'bg-white',
      border: 'border-2 border-dashed border-violet-200 hover:border-violet-400',
      iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
      iconColor: 'text-white',
      hover: 'hover:shadow-lg hover:scale-[1.02]',
      gradient: 'bg-gradient-to-br from-violet-50 to-purple-50'
    },
    orange: {
      bg: 'bg-white',
      border: 'border-2 border-dashed border-orange-200 hover:border-orange-400',
      iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
      iconColor: 'text-white',
      hover: 'hover:shadow-lg hover:scale-[1.02]',
      gradient: 'bg-gradient-to-br from-orange-50 to-amber-50'
    }
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`
        ${style.bg} ${style.border} ${style.hover}
        rounded-2xl p-6 cursor-pointer
        transition-all duration-300 ease-out
        group relative overflow-hidden
      `}
    >
      {/* Background decoration */}
      <div className={`absolute inset-0 ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      <div className="relative flex flex-col items-center justify-center text-center py-8">
        {/* Icon */}
        <div className={`
          ${style.iconBg} ${style.iconColor}
          w-16 h-16 rounded-2xl 
          flex items-center justify-center
          mb-4 shadow-lg
          group-hover:scale-110 group-hover:rotate-3
          transition-all duration-300
        `}>
          {icon || <FiPlus className="w-8 h-8" />}
        </div>

        {/* Text */}
        <h3 className="text-lg font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
          {title}
        </h3>
        
        {description && (
          <p className="mt-2 text-sm text-gray-500 max-w-xs">
            {description}
          </p>
        )}

        {/* Hover indicator */}
        <div className="mt-4 flex items-center gap-1 text-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span>Click to add</span>
          <FiPlus className="w-4 h-4" />
        </div>
      </div>

      {/* Corner decoration */}
      <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
        <div className="absolute top-1 right-1 w-8 h-8 bg-gray-100 rounded-bl-full group-hover:bg-blue-100 transition-colors duration-300" />
      </div>
    </div>
  );
};

export default AddCard;
