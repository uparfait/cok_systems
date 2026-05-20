import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import ReceptionistDashboard from '../../systems/serviceDelivery/pages/ReceptionistDashboard'
import EmployeeDashboard from '../../systems/serviceDelivery/pages/EmployeeDashboard'
import DepartmentManagerDashboard from '../../systems/serviceDelivery/pages/DepartmentManagerDashboard'
import SmartParkingDashboard from '../../systems/smartParking/pages/SmartParkingDashboard'
import AdminDashboard from '../../systems/admin/pages/AdminDashboard'

const RoleDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const role = (user?.role || '').toLowerCase().trim()

  if (role.includes('receptionist')) return <ReceptionistDashboard />
  if (role.includes('employee') || role.includes('staff')) return <EmployeeDashboard />
  if (role.includes('department manager') || role.includes('department head') || role.includes('head of department') || role.includes('director')) return <DepartmentManagerDashboard />
  if ((role.includes('manager') || role.includes('head')) && !role.includes('receptionist')) return <DepartmentManagerDashboard />
  if (role.includes('gate') && role.includes('vehicle')) return <SmartParkingDashboard />
  if (role.includes('admin') || role.includes('system')) return <AdminDashboard />

  return <AdminDashboard />
}

export default RoleDashboardPage