// Common helper functions for Service Delivery System
// Centralized utility functions to avoid duplication

// ==================== Name Helper Functions ====================

/**
 * Get initials from a full name
 * @param name - Full name string
 * @returns Initials in uppercase (e.g., "John Doe" -> "JD")
 */
export const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Get color from name for avatar
 * @param name - Name string
 * @returns Tailwind color class
 */
export const getColorFromName = (name: string): string => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// ==================== Date/Time Helper Functions ====================

/**
 * Format date for display
 * @param date - Date object
 * @returns Formatted date string (e.g., "MAR 09, 2026")
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric' 
  }).toUpperCase();
};

/**
 * Format time for display
 * @param date - Date object
 * @returns Formatted time string (e.g., "10:30 AM")
 */
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  }).toUpperCase();
};

// ==================== Status Helper Functions ====================

/**
 * Get status badge styles for receptionist visitor status
 */
export const getVisitorStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return { bg: 'bg-orange-100', border: 'br-20', text: 'text-orange-500', label: 'PENDING' };
    case 'waiting':
      return { bg: 'bg-green-400', border: 'br-20', text: 'text-green-700', label: 'ASSIGNED' };
    case 'In_progress':
      return { bg: 'bg-green-100', border: 'br-20', text: 'text-green-700', label: 'IN_PROGRESS' };
    case 'completed':
      return { bg: 'bg-orange-300', border: 'br-20', text: 'text-white', label: 'COMPLETED' };
    default:
      return { bg: 'bg-gray-100', border: 'br-20', text: 'text-gray-800', label: status };
  }
};

/**
 * Get status badge styles for employee service records
 */
export const getServiceRecordStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return { bg: 'bg-[#fff3e0]', text: 'text-[#f57c00]', label: 'Pending' };
    case 'completed':
      return { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', label: 'Completed' };
    case 'transferred':
      return { bg: 'bg-[#e3f2fd]', text: 'text-[#1565c0]', label: 'Transferred' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
};

/**
 * Get status badge styles for service status visitors
 */
export const getServiceStatusBadge = (status: string) => {
  switch (status) {
    case 'Pending':
      return { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Pending' };
    case 'In-Progress':
      return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'In-Progress' };
    case 'Completed':
      return { bg: 'bg-green-100', text: 'text-green-600', label: 'Completed' };
    case 'Transferred':
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Transferred' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
};

/**
 * Get status badge styles for department employees
 */
export const getEmployeeStatusBadge = (status: string) => {
  switch (status) {
    case 'Active':
    case 'available':
      return { bg: 'bg-green-100', text: 'text-green-600', label: 'Active' };
    case 'Away':
    case 'busy':
      return { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Away' };
    case 'off':
      return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Off' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
};

// ==================== Filter Helper Functions ====================

/**
 * Filter visitors by search term
 */
export const filterVisitorsBySearch = (
  visitors: { fullName?: string; full_name?: string; nationalId?: string; identification?: string; telephone?: string }[],
  searchTerm: string
) => {
  const term = searchTerm.toLowerCase();
  return visitors.filter(visitor => {
    const fullName = (visitor.fullName || visitor.full_name || '').toLowerCase();
    const id = visitor.nationalId || visitor.identification || '';
    const phone = visitor.telephone || '';
    return fullName.includes(term) || id.includes(term) || phone.includes(term);
  });
};

/**
 * Filter service status visitors by search term
 */
export const filterServiceStatusBySearch = (
  visitors: { fullName: string; requestId: string; contact: string }[],
  searchTerm: string
) => {
  const term = searchTerm.toLowerCase();
  return visitors.filter(visitor => 
    visitor.fullName.toLowerCase().includes(term) ||
    visitor.requestId.toLowerCase().includes(term) ||
    visitor.contact.includes(term)
  );
};

// ==================== Pagination Helper Functions ====================

/**
 * Calculate pagination values
 */
export const calculatePagination = (
  totalItems: number,
  currentPage: number,
  itemsPerPage: number
) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  return {
    totalPages,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

// ==================== Array Helper Functions ====================

/**
 * Get paginated items from array
 */
export const getPaginatedItems = <T>(
  items: T[],
  currentPage: number,
  itemsPerPage: number
): T[] => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return items.slice(startIndex, startIndex + itemsPerPage);
};

/**
 * Count items by status
 */
export const countByStatus = <T extends { status: string }>(
  items: T[],
  status: string
): number => {
  return items.filter(item => item.status === status).length;
};
