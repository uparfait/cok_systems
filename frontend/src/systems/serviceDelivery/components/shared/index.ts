// Barrel export for shared components
export { default as Profile } from './Profile';
export { default as Logout } from './Logout';
export { default as NotificationBell, getInitialNotifications } from './Notification';
export type { NotificationType, Notification } from './Notification';

export { default as DashboardSidebar } from './DashboardSidebar';
export type { DashboardSidebarProps, DashboardRole, NavItem } from './DashboardSidebar';

export { default as Pagination } from './Pagination';
export type { PaginationProps, PaginationStyle } from './Pagination';

export { default as DashboardHeader } from './DashboardHeader';
export type { DashboardHeaderProps, DashboardRole as HeaderRole } from './DashboardHeader';

export { default as DashboardLayout } from './DashboardLayout';
export type { DashboardLayoutProps, DashboardTab, NavItem as LayoutNavItem } from './DashboardLayout';

export { default as ServiceStatusBadge, getStatusInfo } from './ServiceStatusBadge';
export type { ServiceStatusBadgeProps, ServiceStatus } from './ServiceStatusBadge';
